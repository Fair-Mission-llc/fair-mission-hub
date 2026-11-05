'use client';
// Sprint 11 Revision 19.6 (schema 112): the relational parent organizations on the Super Admin screens.
//   - ParentOrgTierSelect: the 'Parent organization' picker that scopes Global Lookup Tables and Platform Settings to the
//     shared platform defaults (parent_org_id NULL) or one organization's own rows.
//   - ParentOrganizationsCard: the ParentOrganizations list (name, code, vertical, mapped councils), the form that adds
//     one, and the form that maps a council (chapter) to a parent organization and, optionally, a parent council
//     (parentOrganizations.mapCouncil, which keeps Council.parent_organization and tenant_type in step).
import { useState } from 'react';
import {
  councilLabel,
  describeError,
  parentOrgScopeLabel,
  sortCouncils,
  VERTICAL_TYPE_LABELS,
  VERTICAL_TYPES,
  type ParentOrganizationRecord,
  type VerticalType,
} from '@kofc/shared';
import { Button, Field, Input, Notice, Panel, Select, Table, Td } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';
import { db } from '@/services/db';

/** The value of the picker's shared option. */
const SHARED = 'shared';

/** Every parent organization, for pickers. */
export function useParentOrganizations() {
  return useLoad(() => db.parentOrganizations.list(), []);
}

/** The 'Parent organization' picker: the shared platform defaults (null) or one organization. */
export function ParentOrgTierSelect({
  orgs,
  value,
  onChange,
  sharedLabel = 'Shared by every organization (platform default)',
}: {
  orgs: readonly ParentOrganizationRecord[];
  value: number | null;
  onChange: (value: number | null) => void;
  sharedLabel?: string;
}) {
  return (
    <Field label="Parent organization" className="w-80">
      {(id) => (
        <Select id={id} value={value === null ? SHARED : String(value)} onChange={(e) => onChange(e.target.value === SHARED ? null : Number(e.target.value))}>
          <option value={SHARED}>{sharedLabel}</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.org_name} ({VERTICAL_TYPE_LABELS[o.vertical_type] ?? o.vertical_type})
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** The heading text of a scoped card: 'Shared by every organization' or the organization's name. */
export const tierLabel = (orgs: readonly ParentOrganizationRecord[], value: number | null) => parentOrgScopeLabel(orgs, value);

/** The ParentOrganizations list, the add form and the council mapping form. Super Admins only. */
export function ParentOrganizationsCard() {
  const user = useUser();
  const data = useLoad(async () => {
    const [orgs, mappings, councils] = await Promise.all([db.parentOrganizations.list(), db.parentOrganizations.listMappings(), db.councils.list()]);
    return { orgs, mappings, councils: sortCouncils(councils) };
  }, []);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [draft, setDraft] = useState<{ org_name: string; org_code: string; vertical_type: VerticalType }>({ org_name: '', org_code: '', vertical_type: 'FRATERNAL' });
  const [map, setMap] = useState<{ councilId: string; parentOrgId: string; parentCouncilId: string }>({ councilId: '', parentOrgId: '', parentCouncilId: '' });
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMessage(null);
    try {
      const text = await action();
      await data.reload();
      setMessage({ tone: 'info', text });
    } catch (err) {
      setMessage({ tone: 'error', text: describeError(err) });
    } finally {
      setBusy(false);
    }
  };

  const d = data.data;
  const councilName = (id: number | null) => (id === null ? '–' : (d?.councils.find((c) => c.id === id) ? councilLabel(d.councils.find((c) => c.id === id)!) : `Council ${id}`));

  return (
    <Panel title="Parent organizations" className="mb-6">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Each council belongs to one parent organization. Lookup rows and platform settings filed under a parent organization are read only by its councils;
          rows filed as shared are read by every council. Only the Knights of Columbus code (KofC) turns on the fraternal features.
        </p>
        {message ? (
          <Notice tone={message.tone} onDismiss={() => setMessage(null)}>
            {message.text}
          </Notice>
        ) : null}
        {data.error ? <Notice tone="error">{data.error}</Notice> : null}
        {d ? (
          <>
            <Table caption="Parent organizations" head={['ID', 'Name', 'Code', 'Vertical', 'Councils']}>
              {d.orgs.map((o) => (
                <tr key={o.id}>
                  <Td className="text-muted">{o.id}</Td>
                  <Td className="font-bold">{o.org_name}</Td>
                  <Td>
                    <code>{o.org_code}</code>
                  </Td>
                  <Td>{VERTICAL_TYPE_LABELS[o.vertical_type] ?? o.vertical_type}</Td>
                  <Td>{d.mappings.filter((m) => m.parent_org_id === o.id).length}</Td>
                </tr>
              ))}
            </Table>

            <form
              className="flex flex-wrap items-end gap-3"
              aria-label="Add a parent organization"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const created = await db.parentOrganizations.create(user.memberId, draft);
                  setDraft({ org_name: '', org_code: '', vertical_type: 'FRATERNAL' });
                  return `${created.org_name} is added. Map councils to it below.`;
                });
              }}
            >
              <Field label="Name" className="w-64">
                {(id) => <Input id={id} value={draft.org_name} maxLength={100} onChange={(e) => setDraft({ ...draft, org_name: e.target.value })} />}
              </Field>
              <Field label="Code" className="w-44">
                {(id) => <Input id={id} value={draft.org_code} maxLength={30} placeholder="ELKS_LODGE" onChange={(e) => setDraft({ ...draft, org_code: e.target.value })} />}
              </Field>
              <Field label="Vertical" className="w-52">
                {(id) => (
                  <Select id={id} value={draft.vertical_type} onChange={(e) => setDraft({ ...draft, vertical_type: e.target.value as VerticalType })}>
                    {VERTICAL_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {VERTICAL_TYPE_LABELS[v]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button type="submit" disabled={busy}>
                Add parent organization
              </Button>
            </form>

            <Table caption="Council parent mappings" head={['Council', 'Parent organization', 'Parent council']}>
              {d.councils.map((c) => {
                const m = d.mappings.find((x) => x.council_id === c.id);
                return (
                  <tr key={c.id}>
                    <Td>{councilLabel(c)}</Td>
                    <Td>{m ? tierLabel(d.orgs, m.parent_org_id) : <span className="text-muted">Not mapped (reads {String(c.parent_organization ?? 'KofC')})</span>}</Td>
                    <Td>{councilName(m?.parent_council_id ?? null)}</Td>
                  </tr>
                );
              })}
            </Table>

            <form
              className="flex flex-wrap items-end gap-3"
              aria-label="Map a council to a parent organization"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const councilId = Number(map.councilId);
                  const orgId = Number(map.parentOrgId);
                  await db.parentOrganizations.mapCouncil(user.memberId, councilId, orgId, map.parentCouncilId === '' ? null : Number(map.parentCouncilId));
                  return `${councilName(councilId)} now belongs to ${tierLabel(d.orgs, orgId)}.`;
                });
              }}
            >
              <Field label="Council" className="w-64">
                {(id) => (
                  <Select id={id} value={map.councilId} onChange={(e) => setMap({ ...map, councilId: e.target.value })}>
                    <option value="">Choose…</option>
                    {d.councils.map((c) => (
                      <option key={c.id} value={c.id}>
                        {councilLabel(c)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Parent organization" className="w-64">
                {(id) => (
                  <Select id={id} value={map.parentOrgId} onChange={(e) => setMap({ ...map, parentOrgId: e.target.value })}>
                    <option value="">Choose…</option>
                    {d.orgs.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.org_name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Parent council (optional)" className="w-64">
                {(id) => (
                  <Select id={id} value={map.parentCouncilId} onChange={(e) => setMap({ ...map, parentCouncilId: e.target.value })}>
                    <option value="">None (top level)</option>
                    {d.councils
                      .filter((c) => String(c.id) !== map.councilId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {councilLabel(c)}
                        </option>
                      ))}
                  </Select>
                )}
              </Field>
              <Button type="submit" disabled={busy || map.councilId === '' || map.parentOrgId === ''}>
                Save mapping
              </Button>
            </form>
          </>
        ) : (
          <p className="text-sm text-muted">Loading parent organizations…</p>
        )}
      </div>
    </Panel>
  );
}
