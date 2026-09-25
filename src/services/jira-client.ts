import { decryptSecret } from '@/services/crypto';
import { ISSUE_FIELDS, mapIssue, mapUser, mapWorklog } from '@/services/jira-mappers';
import { readStorage } from '@/services/storage';
import type { JiraAccount, JiraAuthMethod, JiraDeployment, JiraUserSummary } from '@/types/domain';
import type {
  JiraBoard,
  JiraIssue,
  JiraRawIssue,
  JiraRawUser,
  JiraRawWorklog,
  JiraRemoteWorklog,
  JiraSprint,
} from '@/types/jira';

export interface JiraConnectionConfig {
  baseUrl: string;
  deployment: JiraDeployment;
  authMethod: JiraAuthMethod;
  email?: string;
  secret?: string;
}

export interface WorklogPayload {
  started: string;
  timeSpentSeconds: number;
  comment: string;
}

export class JiraRequestError extends Error {
  readonly status: number;

  constructor(status: number, detail?: string) {
    super(JiraRequestError.describe(status, detail));
    this.status = status;
  }

  private static describe(status: number, detail?: string): string {
    switch (status) {
      case 0:
        return 'Não foi possível falar com o Jira. Verifique a URL, sua rede ou VPN.';
      case 401:
        return 'O Jira recusou as credenciais. Confira o e-mail e o token.';
      case 403:
        return 'Você não tem permissão para esta ação no Jira.';
      case 404:
        return 'Item não encontrado no Jira.';
      case 429:
        return 'O Jira limitou as requisições. Aguarde alguns segundos.';
      default:
        return detail || `O Jira respondeu com erro ${status}.`;
    }
  }
}

function normalizeBaseUrl(url: string): string {
  const parsed = new URL(url.trim());
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
}

export function getOriginPattern(baseUrl: string): string {
  return `${new URL(baseUrl).origin}/*`;
}

export class JiraClient {
  private readonly config: JiraConnectionConfig;

  constructor(config: JiraConnectionConfig) {
    this.config = { ...config, baseUrl: normalizeBaseUrl(config.baseUrl) };
  }

  static async fromAccount(account: JiraAccount): Promise<JiraClient> {
    const secret = account.encryptedSecret ? await decryptSecret(account.encryptedSecret) : undefined;
    return new JiraClient({ ...account, secret });
  }

  static async fromStorage(): Promise<JiraClient> {
    const account = await readStorage('account');
    if (!account) {
      throw new Error('Conecte sua conta do Jira para continuar.');
    }
    return JiraClient.fromAccount(account);
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  get deployment(): JiraDeployment {
    return this.config.deployment;
  }

  issueUrl(issueKey: string): string {
    return `${this.config.baseUrl}/browse/${encodeURIComponent(issueKey)}`;
  }

  private buildHeaders(hasBody: boolean): HeadersInit {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Atlassian-Token': 'no-check',
    };
    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }

    const { authMethod, email, secret } = this.config;
    switch (authMethod) {
      case 'apiToken':
        headers.Authorization = `Basic ${btoa(`${email ?? ''}:${secret ?? ''}`)}`;
        break;
      case 'personalToken':
        headers.Authorization = `Bearer ${secret ?? ''}`;
        break;
      case 'browserSession':
        break;
      default: {
        const unsupported: never = authMethod;
        throw new Error(`Método de autenticação desconhecido: ${String(unsupported)}`);
      }
    }
    return headers;
  }

  private async request<TResponse>(path: string, init: { method?: string; body?: unknown } = {}): Promise<TResponse> {
    const hasBody = init.body !== undefined;
    let response: Response;

    try {
      response = await fetch(`${this.config.baseUrl}${path}`, {
        method: init.method ?? 'GET',
        headers: this.buildHeaders(hasBody),
        body: hasBody ? JSON.stringify(init.body) : undefined,
        credentials: this.config.authMethod === 'browserSession' ? 'include' : 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
      });
    } catch {
      throw new JiraRequestError(0);
    }

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as { errorMessages?: string[] } | null;
      throw new JiraRequestError(response.status, errorBody?.errorMessages?.join(' '));
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as TResponse;
  }

  async getMyself(): Promise<JiraUserSummary> {
    const user = await this.request<JiraRawUser>('/rest/api/2/myself');
    return mapUser(user, this.config.deployment);
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    const issue = await this.request<JiraRawIssue>(
      `/rest/api/2/issue/${encodeURIComponent(issueKey)}?fields=${ISSUE_FIELDS.join(',')}`,
    );
    return mapIssue(issue);
  }

  async searchIssues(jql: string, limit = 50): Promise<JiraIssue[]> {
    const issues: JiraRawIssue[] = [];
    const pageSize = Math.min(limit, 100);
    let nextPageToken: string | undefined;

    while (issues.length < limit) {
      const params = new URLSearchParams({ jql, fields: ISSUE_FIELDS.join(','), maxResults: String(pageSize) });

      if (this.config.deployment === 'cloud') {
        if (nextPageToken) {
          params.set('nextPageToken', nextPageToken);
        }
        const page = await this.request<{ issues: JiraRawIssue[]; nextPageToken?: string }>(
          `/rest/api/2/search/jql?${params}`,
        );
        issues.push(...page.issues);
        nextPageToken = page.nextPageToken;
        if (!nextPageToken || page.issues.length === 0) {
          break;
        }
      } else {
        params.set('startAt', String(issues.length));
        const page = await this.request<{ issues: JiraRawIssue[]; total: number }>(`/rest/api/2/search?${params}`);
        issues.push(...page.issues);
        if (issues.length >= page.total || page.issues.length === 0) {
          break;
        }
      }
    }

    return issues.slice(0, limit).map(mapIssue);
  }

  async getIssueWorklogs(
    issue: Pick<JiraIssue, 'key' | 'summary' | 'issueTypeName' | 'issueTypeIconUrl'>,
    from: Date,
    to: Date,
  ): Promise<JiraRemoteWorklog[]> {
    const worklogs: JiraRawWorklog[] = [];
    let startAt = 0;

    for (;;) {
      const params = new URLSearchParams({
        startAt: String(startAt),
        maxResults: '1000',
        startedAfter: String(from.getTime()),
        startedBefore: String(to.getTime()),
      });
      const page = await this.request<{ worklogs: JiraRawWorklog[]; total: number }>(
        `/rest/api/2/issue/${encodeURIComponent(issue.key)}/worklog?${params}`,
      );
      worklogs.push(...page.worklogs);
      startAt += page.worklogs.length;
      if (startAt >= page.total || page.worklogs.length === 0) {
        break;
      }
    }

    return worklogs.map((worklog) => mapWorklog(worklog, issue, this.config.deployment));
  }

  async addWorklog(issueKey: string, payload: WorklogPayload): Promise<string> {
    const created = await this.request<{ id: string }>(
      `/rest/api/2/issue/${encodeURIComponent(issueKey)}/worklog?adjustEstimate=auto`,
      { method: 'POST', body: payload },
    );
    return created.id;
  }

  async updateWorklog(issueKey: string, worklogId: string, payload: WorklogPayload): Promise<void> {
    await this.request(
      `/rest/api/2/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}?adjustEstimate=auto`,
      { method: 'PUT', body: payload },
    );
  }

  async deleteWorklog(issueKey: string, worklogId: string): Promise<void> {
    await this.request(
      `/rest/api/2/issue/${encodeURIComponent(issueKey)}/worklog/${encodeURIComponent(worklogId)}?adjustEstimate=auto`,
      { method: 'DELETE' },
    );
  }

  async searchUsers(query: string): Promise<JiraUserSummary[]> {
    const param = this.config.deployment === 'cloud' ? 'query' : 'username';
    const users = await this.request<JiraRawUser[]>(
      `/rest/api/2/user/search?${param}=${encodeURIComponent(query)}&maxResults=20`,
    );
    return users.map((user) => mapUser(user, this.config.deployment)).filter((user) => user.id);
  }

  async getBoards(name: string): Promise<JiraBoard[]> {
    const params = new URLSearchParams({ maxResults: '50' });
    if (name) {
      params.set('name', name);
    }
    const page = await this.request<{ values: JiraBoard[] }>(`/rest/agile/1.0/board?${params}`);
    return page.values;
  }

  async getSprints(boardId: number): Promise<JiraSprint[]> {
    const sprints: JiraSprint[] = [];
    let startAt = 0;

    for (;;) {
      const page = await this.request<{ values: JiraSprint[]; isLast: boolean }>(
        `/rest/agile/1.0/board/${boardId}/sprint?state=active,closed&maxResults=50&startAt=${startAt}`,
      );
      sprints.push(...page.values);
      startAt += page.values.length;
      if (page.isLast || page.values.length === 0) {
        break;
      }
    }

    return sprints.reverse();
  }

  async getSprintIssues(sprintId: number): Promise<JiraIssue[]> {
    const issues: JiraRawIssue[] = [];
    let startAt = 0;

    for (;;) {
      const page = await this.request<{ issues: JiraRawIssue[]; total: number }>(
        `/rest/agile/1.0/sprint/${sprintId}/issue?fields=${ISSUE_FIELDS.join(',')}&maxResults=100&startAt=${startAt}`,
      );
      issues.push(...page.issues);
      startAt += page.issues.length;
      if (startAt >= page.total || page.issues.length === 0) {
        break;
      }
    }

    return issues.map(mapIssue);
  }
}
