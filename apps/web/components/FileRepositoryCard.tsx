'use client';
// The File Repository Mode card (Sprint 10 Revision 3.1, file-repository.ts), in the System Settings drawer of Council
// Wide Settings: Cloud (the Google Drive vault) or Local Network Server. Local Network Server takes the server network
// address (a UNC path) and the service account username; the service account password is saved on the Credentials
// Vault page (FILE_SERVER_PASSWORD), which the card links to and reports on. The council's Admins and Super Admins save
// it (councils.setFileRepositorySettings); everyone else reads the mode.
import Link from 'next/link';
import { useState } from 'react';
import {
  canAdministerCouncil,
  cleanFileRepositorySettings,
  councilFileRepository,
  describeError,
  FILE_REPOSITORY_MODES,
  FILE_SERVER_PASSWORD_KEY,
  FILE_SERVER_PATH_MAX_LENGTH,
  FILE_SERVER_USERNAME_MAX_LENGTH,
  type Council,
  type CredentialStatus,
  type FileRepositoryMode,
} from '@kofc/shared';
import { Button, Field, Input, Notice, Panel, Select } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export const FILE_REPOSITORY_CARD_TITLE = 'File Repository Mode';

/** Whether the vault holds the service account password (home council only; the server refuses any other). */
async function passwordSaved(councilId: number): Promise<boolean | null> {
  const res = await fetch(`/api/councils/credentials?councilId=${councilId}`, { credentials: 'same-origin' }).catch(() => null);
  if (!res || !res.ok) return null;
  const answer = (await res.json().catch(() => null)) as { credentials?: CredentialStatus[] } | null;
  return Boolean(answer?.credentials?.some((c) => c.credential_key === FILE_SERVER_PASSWORD_KEY));
}

export function FileRepositoryCard({ council, onSaved }: { council: Council; onSaved: () => Promise<void> }) {
  const user = useUser();
  const saved = councilFileRepository(council);
  const mayEdit = canAdministerCouncil(user, council.id);
  const home = council.id === user.councilId;
  const [mode, setMode] = useState<FileRepositoryMode>(saved.file_repository_mode);
  const [path, setPath] = useState(saved.file_server_path ?? '');
  const [username, setUsername] = useState(saved.file_server_username ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const password = useLoad(() => (mayEdit && home ? passwordSaved(council.id) : Promise.resolve(null)), [council.id, mayEdit, home]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const settings = cleanFileRepositorySettings({ file_repository_mode: mode, file_server_path: path, file_server_username: username });
      await db.councils.setFileRepositorySettings(user.memberId, council.id, settings);
      await onSaved();
      setMessage({
        tone: 'info',
        text: mode === 'LOCAL_NETWORK' ? 'Saved. New uploads go to the council file server.' : 'Saved. New uploads go to the Google Drive vault.',
      });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={FILE_REPOSITORY_CARD_TITLE} className="mt-6">
      <p className="mb-3 text-base">
        Choose where the portal files uploaded documents and check photos. With <strong>Local Network Server</strong>, the portal server writes every upload
        straight to the council&apos;s file server; nothing is kept on the uploader&apos;s own computer or phone.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="File Repository Mode">
          {(id) => (
            <Select id={id} value={mode} disabled={!mayEdit || busy} onChange={(e) => setMode(e.target.value as FileRepositoryMode)}>
              {FILE_REPOSITORY_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {mode === 'LOCAL_NETWORK' ? (
          <>
            <Field label="Server Network Address (UNC/IP Path)" hint="For example \\hall-server\kofc or \\192.168.1.20\kofc">
              {(id) => <Input id={id} value={path} maxLength={FILE_SERVER_PATH_MAX_LENGTH} disabled={!mayEdit || busy} onChange={(e) => setPath(e.target.value)} />}
            </Field>
            <Field label="Service Account Username" hint="For example HALL\kofc-portal. Leave it blank to use the portal server's own account.">
              {(id) => (
                <Input id={id} value={username} maxLength={FILE_SERVER_USERNAME_MAX_LENGTH} disabled={!mayEdit || busy} onChange={(e) => setUsername(e.target.value)} />
              )}
            </Field>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold">Service Account Password</span>
              <span className="text-sm">
                {!home
                  ? 'Saved in that council’s own Credentials Vault, which only its Admins open.'
                  : password.data === true
                    ? '✓ Saved in the Credentials Vault.'
                    : password.data === false
                      ? '○ Not saved yet.'
                      : 'Kept in the Credentials Vault.'}{' '}
                {home ? (
                  <Link href="/credentials-vault" className="font-bold underline">
                    Open the Credentials Vault
                  </Link>
                ) : null}
              </span>
            </div>
          </>
        ) : null}
      </div>
      {mayEdit ? (
        <Button className="mt-3" variant="gold" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save file repository'}
        </Button>
      ) : (
        <p className="mt-3 text-sm text-muted">Only the council&apos;s Admins and Super Admins change where files are kept.</p>
      )}
      {message ? (
        <div className="mt-3">
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        </div>
      ) : null}
    </Panel>
  );
}
