"use client";

import Link from "next/link";
import { BulkRefreshProgress } from "@/components/BulkRefreshProvider";
import { HeaderActions } from "@/components/HeaderActions";

type Props = {
  backHref: string;
  backLabel: string;
  children?: React.ReactNode;
};

export function AppSubHeader({ backHref, backLabel, children }: Props) {
  return (
    <header className="app-subheader">
      <div className="app-nav-pill app-subheader-pill">
        <Link href={backHref} className="app-back-link">
          <span aria-hidden="true">←</span> {backLabel}
        </Link>
        {children ? <HeaderActions>{children}</HeaderActions> : null}
      </div>
      <BulkRefreshProgress />
    </header>
  );
}
