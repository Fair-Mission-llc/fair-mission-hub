// The testing sandbox's hall mesh (Sprint 11 Revision 20.0, data-modes.ts). SERVER ONLY.
//
// In testing mode every laptop in the same hall keeps its own testing-sandbox.db. Each save one laptop makes through the
// hub (callHub) is broadcast on the local Wi-Fi as one UDP packet to LAN_MESH_PORT, and every other laptop replays the
// same call on its own file, so their records keep in step while they share the network.
//
// Security:
//   - Every packet is sealed with AES-256-GCM under a key made from the hall's mesh passphrase (scrypt). A laptop
//     without the same passphrase can neither read nor forge a packet: a bad packet fails its tag check and is dropped.
//   - The passphrase comes from KOFC_MESH_PASSPHRASE or .testing-key.json beside the vault (TESTING_KEY_FILE), at least
//     LAN_MESH_MIN_PASSPHRASE_LENGTH characters. Sprint 11 Revision 21.0: when neither exists, testing mode writes a new
//     key file with a random 256-bit passphrase on boot (ensureTestingKeyFile, owner read/write only). Every laptop in
//     the hall needs the same file: copy the first laptop's file to the others.
//   - Only saves are sent (isMeshReplicatedMethod): never reads, sign-ins or passkeys. A replayed save still runs every
//     rule of the data service, as the actor it names.
//   - A packet older than LAN_MESH_MAX_AGE_MS, or one already heard (origin + seq), is dropped.
//   - Only testing mode starts the mesh. Production and training never open the socket.
//
// Off the hall network (no Wi-Fi, a send error) nothing breaks: the save is already on this laptop's file, and the
// mesh only logs that the broadcast did not go out. Saves are replayed call by call, not merged: two laptops that
// add records at the same moment can number them differently, which is acceptable for a practice copy.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { createSocket, type Socket } from 'node:dgram';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isFreshLanMeshEnvelope,
  LAN_MESH_MAX_PACKET_BYTES,
  LAN_MESH_MIN_PASSPHRASE_LENGTH,
  LAN_MESH_PASSPHRASE_ENV,
  LAN_MESH_PORT,
  readLanMeshEnvelope,
  TESTING_KEY_FILE,
  type TestingKeyFile,
  type HubCall,
  type LanMeshEnvelope,
} from '@kofc/shared';

type Env = Record<string, string | undefined>;

const SALT = 'kofc-testing-mesh-v1';
const AAD = Buffer.from('kofc-testing-sandbox');
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SEEN_LIMIT = 5000;

const keyFilePath = (dir: string) => join(/*turbopackIgnore: true*/ dir, TESTING_KEY_FILE);

/** The passphrase in the vault's testing key file, or '' when the file is missing or unreadable. */
function readTestingKeyFile(dir: string): string {
  const file = keyFilePath(dir);
  if (!existsSync(file)) return '';
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<TestingKeyFile>;
    return typeof parsed.passphrase === 'string' ? parsed.passphrase.trim() : '';
  } catch {
    console.warn(`[mesh] ${TESTING_KEY_FILE} could not be read; testing mode works alone until the file is fixed or deleted.`);
    return '';
  }
}

/** The hall's mesh passphrase, or null when none is set (the mesh stays off). */
export function meshPassphrase(dir: string, env: Env = process.env): string | null {
  const value = env[LAN_MESH_PASSPHRASE_ENV]?.trim() || readTestingKeyFile(dir);
  return value && value.length >= LAN_MESH_MIN_PASSPHRASE_LENGTH ? value : null;
}

/**
 * Writes the vault's testing key file with a random passphrase when testing mode boots without one. Does nothing when
 * KOFC_MESH_PASSPHRASE is set or the file already exists (an existing file is never overwritten). Returns the path of
 * the file it wrote, or null.
 */
export function ensureTestingKeyFile(dir: string, env: Env = process.env, now: Date = new Date()): string | null {
  if (env[LAN_MESH_PASSPHRASE_ENV]?.trim()) return null;
  const file = keyFilePath(dir);
  if (existsSync(file)) return null;
  const key: TestingKeyFile = { version: 1, passphrase: randomBytes(32).toString('base64url'), createdAt: now.toISOString() };
  try {
    // 'wx' refuses to overwrite a file another process wrote a moment ago; 0o600 keeps it to this Windows/Unix user.
    writeFileSync(file, `${JSON.stringify(key, null, 2)}
`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return null;
    throw err;
  }
  console.info(`[mesh] made a new testing key at ${file}. Copy this file to the vault folder of every laptop in the hall.`);
  return file;
}

/** The 32-byte key every laptop with the same passphrase derives. */
export const meshKey = (passphrase: string): Buffer => scryptSync(passphrase, SALT, 32);

/** Seals one envelope: IV, tag, then the ciphertext. */
export function sealMeshEnvelope(envelope: LanMeshEnvelope, key: Buffer): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(AAD);
  const body = Buffer.concat([cipher.update(JSON.stringify(envelope), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

/** Opens one packet; null when it was not sealed with this key, was changed on the way, or is not an envelope. */
export function openMeshPacket(packet: Buffer, key: Buffer): LanMeshEnvelope | null {
  if (packet.length <= IV_BYTES + TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, packet.subarray(0, IV_BYTES));
    decipher.setAAD(AAD);
    decipher.setAuthTag(packet.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const text = Buffer.concat([decipher.update(packet.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
    return readLanMeshEnvelope(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Remembers the packets already replayed, so a packet heard twice is replayed once. */
export class MeshReplayGuard {
  private readonly seen = new Set<string>();
  constructor(private readonly self: string) {}

  /** True when the envelope should be replayed now; false for our own, stale or repeated packets. */
  accept(envelope: LanMeshEnvelope, now: Date): boolean {
    if (envelope.origin === this.self || !isFreshLanMeshEnvelope(envelope.at, now)) return false;
    const key = `${envelope.origin}:${envelope.seq}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    if (this.seen.size > SEEN_LIMIT) this.seen.delete(this.seen.values().next().value as string);
    return true;
  }
}

interface Mesh {
  socket: Socket;
  key: Buffer;
  origin: string;
  seq: number;
}

let mesh: Mesh | null = null;

/**
 * Starts the mesh once per process: binds LAN_MESH_PORT with broadcast on and replays each good packet through
 * `replay`, one at a time. Does nothing without a passphrase. Returns whether the mesh is running.
 */
export function startLanMesh(dir: string, env: Env, replay: (call: HubCall) => Promise<void>): boolean {
  if (mesh) return true;
  try {
    ensureTestingKeyFile(dir, env);
  } catch (err) {
    console.warn(`[mesh] the testing key could not be written (${err instanceof Error ? err.message : String(err)}).`);
  }
  const passphrase = meshPassphrase(dir, env);
  if (!passphrase) {
    console.info('[mesh] testing mode is working alone: no mesh passphrase is set, so no saves are shared with other laptops.');
    return false;
  }
  const key = meshKey(passphrase);
  const origin = randomBytes(8).toString('hex');
  const guard = new MeshReplayGuard(origin);
  const socket = createSocket({ type: 'udp4', reuseAddr: true });
  let chain: Promise<void> = Promise.resolve();
  socket.on('message', (packet) => {
    const envelope = openMeshPacket(packet, key);
    if (!envelope || !guard.accept(envelope, new Date())) return;
    chain = chain
      .then(() => replay({ method: envelope.method, args: envelope.args }))
      .catch((err: unknown) => console.warn(`[mesh] a save from another laptop (${envelope.method}) was not replayed: ${err instanceof Error ? err.message : String(err)}`));
  });
  socket.on('error', (err) => console.warn(`[mesh] the hall network is unavailable (${err.message}); testing mode keeps working alone.`));
  socket.bind(LAN_MESH_PORT, () => {
    try {
      socket.setBroadcast(true);
    } catch {
      // No broadcast-capable network: saves stay on this laptop.
    }
  });
  socket.unref();
  mesh = { socket, key, origin, seq: 0 };
  console.info(`[mesh] testing mode shares saves with the laptops in this hall on UDP port ${LAN_MESH_PORT}.`);
  return true;
}

/** Sends one save to the hall. Silent when the mesh is off; a send failure is only logged. */
export function broadcastMeshSave(call: HubCall): void {
  if (!mesh) return;
  mesh.seq += 1;
  const packet = sealMeshEnvelope({ v: 1, origin: mesh.origin, seq: mesh.seq, method: call.method, args: call.args, at: new Date().toISOString() }, mesh.key);
  if (packet.length > LAN_MESH_MAX_PACKET_BYTES) {
    console.warn(`[mesh] ${call.method} is too large to share (${packet.length} bytes); it stays on this laptop.`);
    return;
  }
  mesh.socket.send(packet, LAN_MESH_PORT, '255.255.255.255', (err) => {
    if (err) console.warn(`[mesh] ${call.method} was not shared (${err.message}); it is saved on this laptop.`);
  });
}

/** Stops the mesh (tests). */
export function stopLanMesh(): void {
  if (!mesh) return;
  mesh.socket.close();
  mesh = null;
}
