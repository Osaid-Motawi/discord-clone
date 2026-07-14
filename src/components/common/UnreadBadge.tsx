/** Small red notification badge showing an unread count (caps display at 99+). */
export function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold leading-none text-white shadow-[0_0_6px_rgba(251,84,119,0.6)]"
      aria-label={`${count} unread message${count === 1 ? "" : "s"}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
