interface AvatarProps {
  name?: string;
  image?: string;
  size?: number;
  online?: boolean;
}

/** User avatar with an optional presence dot. Falls back to the name initial. */
export function Avatar({ name, image, size = 32, online }: AvatarProps) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      {image ? (
        <img
          src={image}
          alt={name ?? "avatar"}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-accent text-sm font-medium text-white">
          {initial}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-sidebar ${
            online ? "bg-online" : "bg-offline"
          }`}
          aria-label={online ? "online" : "offline"}
        />
      )}
    </div>
  );
}
