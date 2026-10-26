'use client';
// The role-manual bar on top of an officer desk (Sprint 9 Master Hardening Pass). Each desk passes its seat's manual
// token - TREASURER_MANUAL, FINANCIAL_SECRETARY_MANUAL or EXECUTIVE_GOVERNANCE_MANUAL (role-manuals.ts) - and gets:
//   - '📘 <title> (PDF)', the compiled print edition opened in a new tab (GET /api/manuals/pdf);
//   (Sprint 10 Revision 5.0 removed the '📋 Copy link' button beside the PDF.)
//   - 'How do I…', a search over that one manual's task workflows (GET /api/manuals). The best matches open in place
//     with their steps, so the officer never leaves the desk. Nothing outside the seat's own manual is searched.
// Sprint 11 Revision 2.0: the Admin Desk passes ADMIN_USER_GUIDE (the Administration Manual) and splits the bar across its
// first two drawers with `show`: 'pdf' for the link alone, 'search' for the search alone.
import { useState } from 'react';
import { deskManualByToken, roleManualPdfHref, roleManualTasksHref, searchRoleManual, type DeskManualToken, type GuideTask } from '@kofc/shared';
import { MarkdownInline } from '@/components/Markdown';
import { Button, Input } from '@/components/ui';
import { useLoad } from '@/lib/use-load';

async function readManualTasks(href: string): Promise<GuideTask[]> {
  const res = await fetch(href).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { tasks?: GuideTask[]; message?: string } | null;
  if (!res?.ok) throw new Error(body?.message ?? 'The manual could not be read.');
  return body?.tasks ?? [];
}

function ManualAnswer({ task, open, onToggle }: { task: GuideTask; open: boolean; onToggle: () => void }) {
  return (
    <li className="rounded border-2 border-navy bg-white">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-bold text-navy">
        <span>
          {task.id} {task.title}
        </span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t-2 border-navy px-3 py-2 text-sm">
          {task.who ? (
            <p>
              <strong>Who can do this:</strong> <MarkdownInline text={task.who} />
            </p>
          ) : null}
          <p>
            <strong>Goal:</strong> <MarkdownInline text={task.goal} />
          </p>
          {task.startPoint ? (
            <p>
              <strong>Start point:</strong> <MarkdownInline text={task.startPoint} />
            </p>
          ) : null}
          {task.steps.length > 0 ? (
            <ol className="ml-5 list-decimal">
              {task.steps.map((step, i) => (
                <li key={i}>
                  <MarkdownInline text={step} />
                </li>
              ))}
            </ol>
          ) : null}
          {task.expected ? (
            <p>
              <strong>Expected result:</strong> <MarkdownInline text={task.expected} />
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function DeskManualHeader({ manual: token, show = 'both' }: { manual: DeskManualToken; show?: 'both' | 'pdf' | 'search' }) {
  const manual = deskManualByToken(token);
  const pdfHref = roleManualPdfHref(manual.key);
  const tasks = useLoad(() => (show === 'pdf' ? Promise.resolve([]) : readManualTasks(roleManualTasksHref(manual.key))), [manual.key, show]);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const answers = searchRoleManual(tasks.data ?? [], query);

  return (
    <section data-role-manual={manual.token} aria-label={`${manual.title} help`} className="flex flex-col gap-2 rounded border-2 border-gold bg-white p-3 text-navy">
      <div className="flex flex-wrap items-center gap-2">
        {show !== 'search' ? (
          <a href={pdfHref} target="_blank" rel="noopener noreferrer" className="rounded border-2 border-navy bg-navy px-3 py-1 text-sm font-bold text-white">
            📘 {manual.title} (PDF)
          </a>
        ) : null}
        {show !== 'pdf' ? (
          <label className="ml-auto flex min-w-[16rem] flex-1 items-center gap-2 text-sm font-bold">
            How do I…
            <Input
              type="search"
              value={query}
              placeholder={`Search the ${manual.title}`}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpenId(null);
              }}
              className="flex-1"
            />
          </label>
        ) : null}
      </div>
      {tasks.error ? <p className="text-sm text-brand-red">{tasks.error}</p> : null}
      {query.trim() && tasks.data ? (
        answers.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label={`Answers from the ${manual.title}`}>
            {answers.map((task) => {
              // The best match opens on its own until the officer opens or closes one ('' closes all).
              const open = (openId ?? answers[0].id) === task.id;
              return <ManualAnswer key={task.id} task={task} open={open} onToggle={() => setOpenId(open ? '' : task.id)} />;
            })}
          </ul>
        ) : (
          <p className="text-sm">No task in the {manual.title} matches. Try other words, for example a button or page name.</p>
        )
      ) : null}
    </section>
  );
}
