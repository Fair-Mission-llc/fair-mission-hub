// Sprint 9 Revision 4.0: expo-crypto for the pilot hub's server bundle (next.config.ts resolveAlias), backed by
// node:crypto. The phone data layer (apps/mobile/services/drivers/sqlite.ts) runs on the hub laptop and imports it.
import { createHash, randomBytes } from 'node:crypto';

export enum CryptoDigestAlgorithm {
  SHA256 = 'SHA-256',
}
export enum CryptoEncoding {
  HEX = 'hex',
  BASE64 = 'base64',
}

export async function digestStringAsync(algorithm: CryptoDigestAlgorithm, data: string, options: { encoding?: CryptoEncoding } = {}): Promise<string> {
  if (algorithm !== CryptoDigestAlgorithm.SHA256) throw new Error(`The hub supports SHA-256 only, not ${algorithm}.`);
  return createHash('sha256')
    .update(data, 'utf8')
    .digest(options.encoding === CryptoEncoding.BASE64 ? 'base64' : 'hex');
}

export async function getRandomBytesAsync(byteCount: number): Promise<Uint8Array> {
  return new Uint8Array(randomBytes(byteCount));
}
