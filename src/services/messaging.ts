export type ContentScriptRequest =
  | { type: 'timer:get' }
  | { type: 'timer:start'; issueKey: string; issueSummary: string }
  | { type: 'timer:pause' }
  | { type: 'timer:resume' }
  | { type: 'timer:stop' }
  | { type: 'app:open'; path: string };

export interface ContentTimerState {
  isEnabled: boolean;
  issueKey: string | null;
  isRunning: boolean;
  elapsedSeconds: number;
}

const REQUEST_TYPES = new Set<ContentScriptRequest['type']>([
  'timer:get',
  'timer:start',
  'timer:pause',
  'timer:resume',
  'timer:stop',
  'app:open',
]);

const ISSUE_KEY_LIMIT = 40;

export function isContentScriptRequest(value: unknown): value is ContentScriptRequest {
  const candidate = value as ContentScriptRequest | null;
  if (!candidate || !REQUEST_TYPES.has(candidate.type)) {
    return false;
  }
  if (candidate.type === 'timer:start') {
    return (
      typeof candidate.issueKey === 'string' &&
      candidate.issueKey.length <= ISSUE_KEY_LIMIT &&
      typeof candidate.issueSummary === 'string'
    );
  }
  if (candidate.type === 'app:open') {
    return typeof candidate.path === 'string' && candidate.path.startsWith('/');
  }
  return true;
}

export function sendToBackground<TResponse>(request: ContentScriptRequest): Promise<TResponse> {
  return chrome.runtime.sendMessage<ContentScriptRequest, TResponse>(request);
}
