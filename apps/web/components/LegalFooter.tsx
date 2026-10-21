'use client';
// Sprint 8S Revision 8: the low-profile footer under every sign-in view (sign in, Forgot Password?, Request Access) with
// three links - About, Terms of Service and Privacy Policy. Each opens its notice in place of the card, because no
// portal page renders before sign-in. The notices' text lives in @kofc/shared (legal-notices.ts).
import { LEGAL_NOTICES, type LegalNoticeId } from '@kofc/shared';
import { Button } from '@/components/ui';

export function LegalFooter({ onOpen }: { onOpen: (id: LegalNoticeId) => void }) {
  return (
    <footer aria-label="About and legal" className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-white/80">
      {LEGAL_NOTICES.map((notice) => (
        <button key={notice.id} type="button" onClick={() => onOpen(notice.id)} className="underline-offset-2 hover:text-white hover:underline">
          {notice.title}
        </button>
      ))}
    </footer>
  );
}

/** One notice, shown in the sign-in card's place. */
export function LegalNoticePanel({ id, onClose }: { id: LegalNoticeId; onClose: () => void }) {
  const notice = LEGAL_NOTICES.find((n) => n.id === id) ?? LEGAL_NOTICES[0];
  return (
    <section aria-labelledby={`legal-${notice.id}`} className="flex flex-col gap-3">
      <h2 id={`legal-${notice.id}`} className="font-serif text-lg font-bold">
        {notice.title}
      </h2>
      <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1 text-sm leading-relaxed">
        {notice.paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
        {notice.signature ? <p className="font-bold">{notice.signature}</p> : null}
      </div>
      <Button variant="secondary" onClick={onClose}>
        Back to sign in
      </Button>
    </section>
  );
}
