import { authorInitials } from "@annotated/shared";

interface AuthorAvatarProps {
  displayName: string;
  avatarUrl?: string | null;
  size?: number; // px; default 30
}

/** Square brutalist avatar: the author's photo, or an acid initials block when
 *  there's no photo. Hard black border to match the card system. */
export function AuthorAvatar({ displayName, avatarUrl, size = 30 }: AuthorAvatarProps) {
  const px = `${size}px`;
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote avatar (Clerk/X)
      <img
        src={avatarUrl}
        alt={displayName}
        width={size}
        height={size}
        className="flex-none border-[3px] border-[color:var(--b-line)] object-cover"
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <span
      className="grid flex-none place-items-center border-[3px] border-[color:var(--b-line)] bg-[color:var(--b-acid)] font-black text-[color:var(--b-acid-ink)]"
      style={{ width: px, height: px, fontSize: Math.round(size * 0.42) }}
      aria-label={displayName}
    >
      {authorInitials(displayName) || "·"}
    </span>
  );
}

/** Small acid verified check, shown next to verified author names. */
export function VerifiedBadge() {
  return (
    <span
      title="Verified"
      className="inline-grid size-[14px] flex-none place-items-center bg-[color:var(--b-acid)] text-[10px] font-black text-[color:var(--b-acid-ink)]"
      aria-label="Verified"
    >
      ✓
    </span>
  );
}
