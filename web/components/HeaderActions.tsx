"use client";

import { HeaderRefreshActions } from "@/components/BulkRefreshProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export function HeaderActions({ children, className }: Props) {
  return (
    <div className={`header-actions${className ? ` ${className}` : ""}`}>
      <ThemeToggle />
      <HeaderRefreshActions />
      {children}
    </div>
  );
}
