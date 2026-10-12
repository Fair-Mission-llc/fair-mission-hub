'use client';
// The Cross-Council Loaner Library (Sprint 8F, loaner-library.ts): the shared inventory directory every member reads -
// the equipment each council lends to brother councils, who has each item and when it is due back. The council's Grand
// Knight and Deputy Grand Knight (and any Super Admin, for the council they pick) also get the lending desk: list an
// asset, pause it, check it out with a return date and log its return in one click. The same desk sits on the Grand
// Knight Desk of the Active Desks row.
import { canLendCouncilAssets } from '@kofc/shared';
import { CouncilSelect, RequireArea, useCouncilScope } from '@/components/CouncilScope';
import { LoanerLibraryDirectory, LoanerLibraryManager } from '@/components/LoanerLibraryParts';
import { PageTitle } from '@/components/ui';
import { useUser } from '@/lib/session';
import { useLoad } from '@/lib/use-load';

function LoanerLibrary() {
  const user = useUser();
  const scope = useCouncilScope();
  const lender = canLendCouncilAssets(user, scope.councilId);
  // The directory reloads after a loan click on the desk below it.
  const tick = useLoad(async () => Date.now(), []);
  return (
    <>
      <PageTitle actions={lender ? <CouncilSelect scope={scope} /> : null}>Cross-Council Loaner Library</PageTitle>
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          Councils lend tents, sound systems, fryers and other equipment to each other. Find an item below and call the owning council&apos;s Grand Knight to
          borrow it.
        </p>
        <LoanerLibraryDirectory key={tick.data ?? 0} user={user} />
        {lender ? <LoanerLibraryManager user={user} councilId={scope.councilId} onChanged={() => void tick.reload()} /> : null}
      </div>
    </>
  );
}

export default function LoanerLibraryPage() {
  return (
    <RequireArea area="inventory/loaner-library">
      <LoanerLibrary />
    </RequireArea>
  );
}
