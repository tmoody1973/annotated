import { ink, monoStack, muted } from "../lib/clip-styles";

/**
 * Publish-time toggle to mask the author on the public annotation (gap §9).
 * Default off — when on, the feed/landing/profile show "Anonymous" and the
 * author identity is never projected (the backend keeps authorId server-side
 * for claims/moderation only).
 */
export function AnonymousToggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 10,
        fontFamily: monoStack,
        fontSize: 12,
        color: disabled ? muted : ink,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      Post anonymously
    </label>
  );
}
