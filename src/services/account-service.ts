import { destroyVaultKey, encryptSecret } from '@/services/crypto';
import { getOriginPattern, JiraClient, type JiraConnectionConfig } from '@/services/jira-client';
import { readStorage, writeStorage } from '@/services/storage';
import type { JiraAccount } from '@/types/domain';

/**
 * Precisa ser chamada diretamente no handler do clique: o navegador só mostra o
 * pedido de permissão se ele vier de um gesto do usuário.
 */
export function requestJiraPermission(baseUrl: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [getOriginPattern(baseUrl)] });
}

export async function connectAccount(config: JiraConnectionConfig): Promise<JiraAccount> {
  const client = new JiraClient(config);
  const user = await client.getMyself();

  const account: JiraAccount = {
    baseUrl: client.baseUrl,
    deployment: config.deployment,
    authMethod: config.authMethod,
    email: config.authMethod === 'apiToken' ? config.email : undefined,
    encryptedSecret: config.secret ? await encryptSecret(config.secret) : undefined,
    user,
    connectedAt: new Date().toISOString(),
  };

  await writeStorage('account', account);
  return account;
}

export async function disconnectAccount(): Promise<void> {
  const account = await readStorage('account');
  await writeStorage('account', null);
  await destroyVaultKey();

  if (account) {
    await chrome.permissions.remove({ origins: [getOriginPattern(account.baseUrl)] }).catch(() => false);
  }
}
