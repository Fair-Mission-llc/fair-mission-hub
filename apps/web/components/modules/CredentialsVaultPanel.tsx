'use client';
// Credentials Vault (Sprint 6L Extension): the one Setup page for every connection a council keeps a secret for - its
// outbound email account (moved here from the Council Lookups tab), its Google Drive key and (Sprint 6L Extension 2) its
// Microsoft Co-Pilot key, the Microsoft Copilot Studio Direct Line secret (both through /api/councils/credentials). A short status banner leads the page in plain words; no ports or technical flags.
// Audience: seated officers, the council's Admins and Super Admins (canOpenCredentialsVault). Only the council's Admins
// and Super Admins change anything (canAdministerCouncil, the same rule the routes apply); everyone else sees the banner.
import { useState, type FormEvent } from 'react';
import { canAdministerCouncil, councilEmailGateway, councilLabel, describeError, REDACTED_SECRET, type CredentialKey, type CredentialStatus } from '@kofc/shared';
import { CouncilSelect, useCouncilScope } from '@/components/CouncilScope';
import { EmailGatewayPanel, gatewayOnServer } from '@/components/EmailGatewayPanel';
import { TwoFactorDeliveryPanel } from '@/components/TwoFactorSection';
import { Button, Field, Input, Notice, PageTitle, Panel, Textarea } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

const CREDENTIALS_ROUTE = '/api/councils/credentials';

/** Lists (or, with a body, saves or clears) the council's masked credentials. */
async function credentialsOnServer(councilId: number, body?: Record<string, unknown>): Promise<CredentialStatus[]> {
  const res = body
    ? await fetch(CREDENTIALS_ROUTE, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ councilId, ...body }),
      })
    : await fetch(`${CREDENTIALS_ROUTE}?councilId=${councilId}`, { credentials: 'same-origin' });
  const answer = (await res.json().catch(() => null)) as { credentials?: CredentialStatus[]; message?: string } | null;
  if (!res.ok || !answer?.credentials) throw new Error(answer?.message ?? `The server answered HTTP ${res.status}.`);
  return answer.credentials;
}

interface Connection {
  name: string;
  connected: boolean;
  on: string;
  off: string;
}

/** The low-density connectivity banner: one line per connection, a word and a symbol, never colour alone. */
function StatusBanner({ connections, unknown }: { connections: Connection[]; unknown: boolean }) {
  return (
    <section aria-label="Connection status" className="mb-4 rounded border-2 border-navy bg-white p-4">
      <ul className="flex flex-col gap-2 sm:flex-row sm:gap-8">
        {connections.map((c) => (
          <li key={c.name} className="flex items-center gap-2">
            <span aria-hidden="true" className={c.connected ? 'font-bold text-green' : 'font-bold text-muted'}>
              {c.connected ? '✓' : '○'}
            </span>
            <span>
              <span className="font-bold">{c.name}:</span> {unknown ? 'Checking…' : c.connected ? c.on : c.off}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface SecretCard {
  credentialKey: Exclude<CredentialKey, 'SMTP_OUTBOUND_PASSWORD'>;
  title: string;
  intro: string;
  label: string;
  placeholder: string;
  multiLine: boolean;
  maxLength: number;
  savedText: string;
  removedText: string;
}

const DRIVE_CARD: SecretCard = {
  credentialKey: 'GOOGLE_DRIVE_PRIVATE_KEY',
  title: 'Google Drive',
  intro: 'Paste the private key your Google Drive administrator gave the council. It is locked away once saved.',
  label: 'Drive key',
  placeholder: '-----BEGIN PRIVATE KEY-----',
  multiLine: true,
  maxLength: 8000,
  savedText: 'Saved. The council files now go to its own Google Drive.',
  removedText: 'Removed. Council files use the portal Drive again.',
};

const FILE_SERVER_CARD: SecretCard = {
  credentialKey: 'FILE_SERVER_PASSWORD',
  title: 'Network file server',
  intro:
    "Type the password of the service account the portal uses to write to the council's file server (Council Wide Settings, System Settings, File Repository Mode). It is locked away once saved.",
  label: 'Service account password',
  placeholder: 'Service account password',
  multiLine: false,
  maxLength: 256,
  savedText: 'Saved. The portal server signs in to the file server with it.',
  removedText: "Removed. The portal server uses its own account on the file server.",
};

const ONEDRIVE_CARD: SecretCard = {
  credentialKey: 'ONEDRIVE_CLIENT_SECRET',
  title: 'OneDrive / SharePoint',
  intro:
    "Paste the client secret of the council's Azure app registration (File Repository Mode, OneDrive / SharePoint). It is locked away once saved.",
  label: 'Client secret',
  placeholder: 'Client secret value',
  multiLine: false,
  maxLength: 500,
  savedText: 'Saved. The portal server files uploads in SharePoint with it.',
  removedText: 'Removed. SharePoint uploads stop until a new secret is saved.',
};

const DROPBOX_CARD: SecretCard = {
  credentialKey: 'DROPBOX_ACCESS_TOKEN',
  title: 'Dropbox Business',
  intro: "Paste the access token of the council's Dropbox app (File Repository Mode, Dropbox Business). It is locked away once saved.",
  label: 'Access token',
  placeholder: 'Dropbox access token',
  multiLine: false,
  maxLength: 2000,
  savedText: 'Saved. The portal server files uploads in Dropbox with it.',
  removedText: 'Removed. Dropbox uploads stop until a new token is saved.',
};

const COPILOT_CARD: SecretCard = {
  credentialKey: 'COPILOT_STUDIO_DIRECT_LINE_SECRET',
  title: 'Microsoft Co-Pilot (Copilot Studio)',
  intro:
    "Paste the Direct Line secret of the council's Copilot Studio agent (in Copilot Studio: Settings, Security, Web channel security). It is locked away once saved, and only the Marketing Factory uses it.",
  label: 'Co-Pilot key',
  placeholder: 'Direct Line secret',
  multiLine: false,
  maxLength: 500,
  savedText: 'Saved. The Marketing Factory can now ask the Microsoft Co-Pilot.',
  removedText: 'Removed. The Microsoft Co-Pilot is switched off for this council.',
};

// Sprint 6S: receipt reading needs both the resource's endpoint and one of its keys.
const OCR_ENDPOINT_CARD: SecretCard = {
  credentialKey: 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT',
  title: 'Receipt reading: Azure endpoint',
  intro:
    "Paste the Endpoint of the council's Azure Document Intelligence resource (in the Azure portal: the resource, Keys and Endpoint). It looks like https://name.cognitiveservices.azure.com/.",
  label: 'Azure endpoint',
  placeholder: 'https://name.cognitiveservices.azure.com/',
  multiLine: false,
  maxLength: 500,
  savedText: 'Saved. Save the Azure key too, and the expense form can read receipts.',
  removedText: 'Removed. Receipt reading is switched off for this council.',
};

const OCR_KEY_CARD: SecretCard = {
  credentialKey: 'AZURE_DOCUMENT_INTELLIGENCE_KEY',
  title: 'Receipt reading: Azure key',
  intro: 'Paste KEY 1 from the same Keys and Endpoint page. It is locked away once saved, and only the receipt reader uses it.',
  label: 'Azure key',
  placeholder: 'Key 1',
  multiLine: false,
  maxLength: 500,
  savedText: 'Saved. With the endpoint saved too, the expense form can read receipts.',
  removedText: 'Removed. Receipt reading is switched off for this council.',
};

function SecretPanel({ card, councilId, saved, onChanged }: { card: SecretCard; councilId: number; saved: CredentialStatus | undefined; onChanged: () => Promise<void> }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  const run = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await credentialsOnServer(councilId, { credentialKey: card.credentialKey, ...body });
      await onChanged();
      setMessage({ tone: 'info', text: done });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setValue('');
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run({ value }, card.savedText);
  };

  return (
    <Panel title={card.title}>
      <form onSubmit={submit} className="flex max-w-2xl flex-col gap-3" autoComplete="off">
        <p className="text-sm">{card.intro}</p>
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        <Field label={card.label} hint={saved ? 'Saved. Paste a new key only to replace it.' : undefined}>
          {(id) =>
            card.multiLine ? (
              <Textarea
                id={id}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={saved ? REDACTED_SECRET : card.placeholder}
                spellCheck={false}
                maxLength={card.maxLength}
                rows={4}
                disabled={busy}
              />
            ) : (
              <Input
                id={id}
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={saved ? REDACTED_SECRET : card.placeholder}
                autoComplete="new-password"
                spellCheck={false}
                maxLength={card.maxLength}
                disabled={busy}
              />
            )
          }
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !value.trim()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          {saved ? (
            <Button variant="danger" disabled={busy} onClick={() => void run({ clear: true }, card.removedText)}>
              Remove
            </Button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

/**
 * The vault for one council. Sprint 10 Revision 3.0: `homeCouncilOnly` (the Super Admin Desk drawer) pins it to the
 * reader's own home council - no council picker, and no other council's sealed keys are ever requested.
 */
export function CredentialsVaultPanel({ homeCouncilOnly = false, showTitle = !homeCouncilOnly }: { homeCouncilOnly?: boolean; showTitle?: boolean }) {
  const user = useUser();
  const scope = useCouncilScope();
  const councilId = homeCouncilOnly ? user.councilId : scope.councilId;
  const mayEdit = canAdministerCouncil(user, councilId);
  const council = useLoad(() => db.councils.get(councilId), [councilId]);
  // The routes answer only the council's Admins and Super Admins; other officers see the stored settings alone.
  const vault = useLoad(async () => (mayEdit ? { credentials: await credentialsOnServer(councilId), gateway: await gatewayOnServer(councilId) } : null), [councilId, mayEdit]);
  const reload = async () => {
    await Promise.all([council.reload(), vault.reload()]);
  };

  const drive = vault.data?.credentials.find((c) => c.credential_key === 'GOOGLE_DRIVE_PRIVATE_KEY');
  const copilot = vault.data?.credentials.find((c) => c.credential_key === 'COPILOT_STUDIO_DIRECT_LINE_SECRET');
  const ocrEndpoint = vault.data?.credentials.find((c) => c.credential_key === 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT');
  const ocrKey = vault.data?.credentials.find((c) => c.credential_key === 'AZURE_DOCUMENT_INTELLIGENCE_KEY');
  const fileServer = vault.data?.credentials.find((c) => c.credential_key === 'FILE_SERVER_PASSWORD');
  const oneDrive = vault.data?.credentials.find((c) => c.credential_key === 'ONEDRIVE_CLIENT_SECRET');
  const dropbox = vault.data?.credentials.find((c) => c.credential_key === 'DROPBOX_ACCESS_TOKEN');
  const emailOn = councilEmailGateway(council.data) !== null && (vault.data ? Boolean(vault.data.gateway.password) : true);
  const connections: Connection[] = [
    { name: 'Outbound email', connected: emailOn, on: 'Connected to the council mail account', off: 'Using the portal default' },
    ...(mayEdit
      ? [
          { name: 'Google Drive', connected: Boolean(drive), on: 'Connected to the council Drive', off: 'Using the portal Drive' },
          { name: 'Microsoft Co-Pilot', connected: Boolean(copilot), on: 'Connected to Copilot Studio', off: 'Not connected' },
          { name: 'Receipt reading', connected: Boolean(ocrEndpoint && ocrKey), on: 'Connected to Azure Document Intelligence', off: 'Not connected' },
        ]
      : []),
  ];

  return (
    <>
      {!showTitle ? null : homeCouncilOnly ? <PageTitle>Credentials Vault</PageTitle> : <PageTitle actions={<CouncilSelect scope={scope} />}>Credentials Vault</PageTitle>}
      <StatusBanner connections={connections} unknown={council.data === undefined || (mayEdit && vault.loading)} />
      {vault.error ? <Notice tone="error">{vault.error}</Notice> : null}
      {mayEdit ? (
        <div className="flex flex-col gap-4">
          <EmailGatewayPanel key={`email-${councilId}`} councilId={councilId} onChanged={reload} />
          {/* Sprint 11 Revision 8.0: which second-step channels the portal can deliver for this council. */}
          <TwoFactorDeliveryPanel emailGatewayConnected={emailOn} />
          <SecretPanel key={`drive-${councilId}`} card={DRIVE_CARD} councilId={councilId} saved={drive} onChanged={reload} />
          <SecretPanel key={`copilot-${councilId}`} card={COPILOT_CARD} councilId={councilId} saved={copilot} onChanged={reload} />
          <SecretPanel key={`ocr-endpoint-${councilId}`} card={OCR_ENDPOINT_CARD} councilId={councilId} saved={ocrEndpoint} onChanged={reload} />
          <SecretPanel key={`ocr-key-${councilId}`} card={OCR_KEY_CARD} councilId={councilId} saved={ocrKey} onChanged={reload} />
          <SecretPanel key={`file-server-${councilId}`} card={FILE_SERVER_CARD} councilId={councilId} saved={fileServer} onChanged={reload} />
          <SecretPanel key={`onedrive-${councilId}`} card={ONEDRIVE_CARD} councilId={councilId} saved={oneDrive} onChanged={reload} />
          <SecretPanel key={`dropbox-${councilId}`} card={DROPBOX_CARD} councilId={councilId} saved={dropbox} onChanged={reload} />
        </div>
      ) : (
        <p className="text-sm">
          {council.data ? `${councilLabel(council.data)}: ` : ''}only the council&apos;s Admins change these connections.
        </p>
      )}
    </>
  );
}
