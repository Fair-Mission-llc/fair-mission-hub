// Sprint 9 Revision 4.0: expo-secure-store for the pilot hub's server bundle (next.config.ts resolveAlias). The hub
// hands the phone data layer its ballot secret directly (hub-vault.ts), so nothing should reach this store; it keeps
// values in memory for the life of the process.
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 6;
const items = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return items.get(key) ?? null;
}
export async function setItemAsync(key: string, value: string, _options?: unknown): Promise<void> {
  items.set(key, value);
}
export async function deleteItemAsync(key: string): Promise<void> {
  items.delete(key);
}
