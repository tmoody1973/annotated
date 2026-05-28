import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { accent, ink, muted, sansStack } from "../lib/clip-styles";

interface TopicSummary {
  _id: string;
  slug: string;
  name: string;
}

const listTopics = makeFunctionReference<"query", Record<string, never>, TopicSummary[]>(
  "topics:list"
);

const MAX_TOPICS = 3;

/**
 * Multi-select topic chips for the publish composers. Enforces 1-3 selection in
 * the UI (publish is gated on `selected.length >= 1` by the parent). Selection is
 * lifted to the parent as an array of topic ids.
 */
export function TopicPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const topics = useQuery(listTopics, {});

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else if (selected.length < MAX_TOPICS) {
      onChange([...selected, id]);
    }
  }

  if (topics === undefined) {
    return <p style={{ fontSize: 12, color: muted, fontFamily: sansStack }}>Loading topics…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: sansStack, color: muted }}>
        Topics (pick 1–3)
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {topics.map((t) => {
          const active = selected.includes(t._id);
          const atCap = !active && selected.length >= MAX_TOPICS;
          return (
            <button
              key={t._id}
              type="button"
              onClick={() => toggle(t._id)}
              disabled={atCap}
              style={{
                border: `2px solid ${ink}`,
                background: active ? accent : "#fff",
                color: ink,
                padding: "3px 8px",
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontFamily: sansStack,
                cursor: atCap ? "not-allowed" : "pointer",
                opacity: atCap ? 0.4 : 1,
                borderRadius: 0,
              }}
            >
              #{t.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
