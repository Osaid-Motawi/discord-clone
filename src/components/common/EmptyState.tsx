import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-text-muted">
      <p className="text-base font-medium">{title}</p>
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}
