export function Spinner({ label }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center gap-2 text-text-muted"
      role="status"
      aria-live="polite"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-muted border-t-transparent" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
