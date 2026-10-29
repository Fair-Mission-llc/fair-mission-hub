'use client';
// The File Repository Mode card (Sprint 10 Revision 3.1; four providers since Revision 3.2, file-repository.ts), in the
// System Settings drawer of Council Wide Settings. The dropdown offers the four provider keys - Google Drive, OneDrive /
// SharePoint, Dropbox Business and Local Network Server - and the card then draws ONLY the fields that provider needs
// (fileRepositoryFields): text inputs for the Council columns it uses, and for each secret (client secret, access token,
// service account password, Drive key) a status line and a link to the Secure Access Vault, where secrets are saved. Every
// other provider's inputs are not rendered at all. The council's Admins and Super Admins save it
// (councils.setFileRepositorySettings, which also clears the columns the provider does not use); everyone else reads it.
import Link from 'next/link';
import { useState } from 'react';
import {
  canAdministerCouncil,
  cleanFileRepositorySettings,
  councilFileRepository,
  describeError,
  FILE_REPOSITORY_MODES,
  FILE_SERVER_PATH_MAX_LENGTH,
  FILE_SERVER_USERNAME_MAX_LENGTH,
  fileRepositoryFields,
  fileRepositoryProvider,
  type Council,
  type CredentialStatus,
  type FileRepositoryMode,
} from '@kofc/shared';
import { Button, Field, Input, Notice, Panel, Select } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

export const FILE_REPOSITORY_CARD_TITLE = 'File Repository Mode';

/** The saved vault keys of the reader's home council (the server refuses any other council). */
async function savedSecretKeys(councilId: number): Promise<Set<string> | null> {
  const res = await fetch(`/api/councils/credentials?councilId=${councilId}`, { credentials: 'same-origin' }).catch(() => null);
  if (!res || !res.ok) return null;
  const answer = (await res.json().catch(() => null)) as { credentials?: CredentialStatus[] } | null;
  return new Set((answer?.credentials ?? []).map((c) => c.credential_key));
}

export function FileRepositoryCard({ council, onSaved }: { council: Council; onSaved: () => Promise<void> }) {
  const user = useUser();
  const saved = councilFileRepository(council);
  const mayEdit = canAdministerCouncil(user, council.id);
  const home = council.id === user.councilId;
  const [mode, setMode] = useState<FileRepositoryMode>(saved.file_repository_mode);
  // One value per Council column, kept while the provider changes so switching back does not lose typing.
  const [values, setValues] = useState({ file_server_path: saved.file_server_path ?? '', file_server_username: saved.file_server_username ?? '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const secrets = useLoad(() => (mayEdit && home ? savedSecretKeys(council.id) : Promise.resolve(null)), [council.id, mayEdit, home]);
  const provider = fileRepositoryProvider(mode);
  const fields = fileRepositoryFields(mode);

  const choose = (next: FileRepositoryMode) => {
    setMode(next);
    setMessage(null);
    // A provider's text fields start from what is saved for it, or blank when the saved values belong to another provider.
    if (next !== saved.file_repository_mode) setValues({ file_server_path: '', file_server_username: '' });
    else setValues({ file_server_path: saved.file_server_path ?? '', file_server_username: saved.file_server_username ?? '' });
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const settings = cleanFileRepositorySettings({ file_repository_mode: mode, ...values });
      await db.councils.setFileRepositorySettings(user.memberId, council.id, settings);
      await onSaved();
      setMessage({ tone: 'info', text: `Saved. New uploads go to ${provider.label}.` });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title={FILE_REPOSITORY_CARD_TITLE} className="mt-6">
      <p className="mb-3 text-base">
        Choose where the portal files uploaded documents and check photos. The portal server sends every upload straight to the provider; nothing is kept on the
        uploader&apos;s own computer or phone. Only the settings the chosen provider needs are shown.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="File Repository Provider" help="Where the portal files council documents, photos and receipts. Each provider asks for its own folder details.">
          {(id) => (
            <Select id={id} value={mode} disabled={!mayEdit || busy} onChange={(e) => choose(e.target.value as FileRepositoryMode)}>
              {FILE_REPOSITORY_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p className="self-end pb-2 text-sm text-muted" data-provider={mode}>
          {provider.summary}
        </p>
        {fields.map((f) =>
          f.kind === 'text' ? (
            <Field key={f.key} label={f.required ? f.label : `${f.label} (optional)`} hint={f.hint}>
              {(id) => (
                <Input
                  id={id}
                  value={values[f.key as 'file_server_path' | 'file_server_username']}
                  maxLength={f.key === 'file_server_path' ? FILE_SERVER_PATH_MAX_LENGTH : FILE_SERVER_USERNAME_MAX_LENGTH}
                  disabled={!mayEdit || busy}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              )}
            </Field>
          ) : (
            <div key={f.key} className="flex flex-col gap-1">
              <span className="text-sm font-bold">{f.required ? f.label : `${f.label} (optional)`}</span>
              <span className="text-sm">
                {!home
                  ? 'Saved in that council’s own Secure Access Vault, which only its Admins open.'
                  : secrets.data?.has(f.key)
                    ? '✓ Saved in the Secure Access Vault.'
                    : secrets.data
                      ? '○ Not saved yet.'
                      : 'Kept in the Secure Access Vault.'}{' '}
                {home ? (
                  <Link href="/credentials-vault" className="font-bold underline">
                    Open the Secure Access Vault
                  </Link>
                ) : null}
              </span>
              <span className="text-xs text-muted">{f.hint}</span>
            </div>
          ),
        )}
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
