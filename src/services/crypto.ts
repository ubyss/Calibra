import type { EncryptedPayload } from '@/types/domain';

const DATABASE_NAME = 'timesheet-vault';
const STORE_NAME = 'keys';
const KEY_ID = 'credentials';

function openVault(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runVaultRequest<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openVault().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const request = action(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/**
 * A chave AES é não-exportável e fica no IndexedDB da extensão: copiar o conteúdo do
 * chrome.storage (ou de um backup) para outra máquina não revela o token.
 */
async function getOrCreateKey(): Promise<CryptoKey> {
  const storedKey = await runVaultRequest<CryptoKey | undefined>('readonly', (store) => store.get(KEY_ID));
  if (storedKey) {
    return storedKey;
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await runVaultRequest('readwrite', (store) => store.put(key, KEY_ID));
  return key;
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function encryptSecret(plainText: string): Promise<EncryptedPayload> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plainText));
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(cipher)) };
}

export async function decryptSecret(payload: EncryptedPayload): Promise<string> {
  const key = await getOrCreateKey();
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(payload.iv) },
    key,
    fromBase64(payload.data),
  );
  return new TextDecoder().decode(plain);
}

export async function destroyVaultKey(): Promise<void> {
  await runVaultRequest('readwrite', (store) => store.delete(KEY_ID));
}
