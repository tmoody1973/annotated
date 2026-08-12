/**
 * Topic chips, in the token palette and without the gate.
 *
 * The old picker labelled itself "Topics (pick 1–3)" because Publish refused to
 * work without one. Topics are now a suggestion the user can take or leave, so
 * the label says what it is and the chips do the rest.
 */
import { useState } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";

interface TopicSummary {
  _id: string;
  slug: string;
  name: string;
}

const listTopics = makeFunctionReference<"query", Record<string, never>, TopicSummary[]>(
  "topics:list",
);

const MAX_TOPICS = 3;

export function TopicChips({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const topics = useQuery(listTopics, {});
  const [expanded, setExpanded] = useState(false);

  if (topics === undefined) {
    return (
      <p className="ann-dim" style={{ fontSize: 12, margin: 0 }}>
        Loading topics…
      </p>
    );
  }

  const toggle = (id: string): void => {
    if (selected.includes(id)) onChange(selected.filter((each) => each !== id));
    else if (selected.length < MAX_TOPICS) onChange([...selected, id]);
  };

  // With something already chosen, show the choice and a way to change it —
  // fifteen chips is a wall of decisions on a screen whose job is the take. The
  // pre-filled topic arrives asynchronously, so this has to be derived rather
  // than seeded into state at mount, when nothing is selected yet.
  const showAll = expanded || selected.length === 0;
  const shown = showAll ? topics : topics.filter((topic) => selected.includes(topic._id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        className="ann-dim"
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Topic
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {shown.map((topic) => {
          const active = selected.includes(topic._id);
          return (
            <button
              key={topic._id}
              type="button"
              onClick={() => toggle(topic._id)}
              aria-pressed={active}
              className="ann-press"
              style={{
                border: "2px solid var(--b-line)",
                background: active ? "var(--b-acid)" : "var(--b-card)",
                color: active ? "var(--b-acid-ink)" : "var(--b-ink)",
                font: "inherit",
                fontSize: 12,
                fontWeight: 700,
                padding: "4px 8px",
                cursor: "pointer",
              }}
            >
              {topic.name}
            </button>
          );
        })}
        {!showAll ? (
          <button type="button" className="ann-link" onClick={() => setExpanded(true)}>
            + change
          </button>
        ) : null}
      </div>
    </div>
  );
}
