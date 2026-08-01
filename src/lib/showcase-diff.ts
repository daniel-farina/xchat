import { promptStyleLabel } from "@/lib/showcase-options";

export type DiffableFields = {
  appName?: string;
  category?: string;
  description: string;
  tools: string;
  prompt: string;
  model: string;
  promptStyle: string;
  creationUrl: string;
  authorName?: string;
  authorHandle?: string;
  imageData?: string;
  previousImageData?: string;
};

/** Human-readable list of what changed between two submission snapshots. */
export function summarizeShowcaseChanges(
  before: DiffableFields,
  after: DiffableFields,
): string[] {
  const changes: string[] = [];

  if (
    before.appName !== undefined &&
    after.appName !== undefined &&
    before.appName.trim() !== after.appName.trim()
  ) {
    changes.push(
      `app name (${before.appName || "—"} → ${after.appName || "—"})`,
    );
  }
  if (
    before.category !== undefined &&
    after.category !== undefined &&
    before.category !== after.category
  ) {
    changes.push(`category (${before.category} → ${after.category})`);
  }
  if (
    before.authorName !== undefined &&
    after.authorName !== undefined &&
    before.authorName.trim() !== after.authorName.trim()
  ) {
    changes.push(
      `display name (${before.authorName || "—"} → ${after.authorName || "—"})`,
    );
  }
  if (
    before.authorHandle !== undefined &&
    after.authorHandle !== undefined &&
    before.authorHandle.toLowerCase() !== after.authorHandle.toLowerCase()
  ) {
    changes.push(
      `handle (@${before.authorHandle || "—"} → @${after.authorHandle || "—"})`,
    );
  }
  if (before.description.trim() !== after.description.trim()) {
    changes.push("description");
  }
  if (normalizeTools(before.tools) !== normalizeTools(after.tools)) {
    changes.push("tools");
  }
  if (before.prompt.trim() !== after.prompt.trim()) {
    changes.push("prompt");
  }
  if (before.model.trim() !== after.model.trim()) {
    changes.push(
      `model (${before.model || "—"} → ${after.model || "—"})`,
    );
  }
  if (before.promptStyle !== after.promptStyle) {
    changes.push(
      `prompt style (${promptStyleLabel(before.promptStyle)} → ${promptStyleLabel(after.promptStyle)})`,
    );
  }
  if (before.creationUrl.trim() !== after.creationUrl.trim()) {
    changes.push("link");
  }
  if (
    after.imageData &&
    before.previousImageData !== undefined &&
    after.imageData !== before.previousImageData
  ) {
    changes.push("photo");
  } else if (
    after.imageData &&
    before.imageData &&
    after.imageData !== before.imageData
  ) {
    changes.push("photo");
  }

  return changes;
}

function normalizeTools(tools: string): string {
  return tools
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");
}

export function formatChangeSummary(changes: string[]): string {
  if (!changes.length) return "";
  if (changes.length === 1) return `Updated ${changes[0]}`;
  if (changes.length === 2) return `Updated ${changes[0]} and ${changes[1]}`;
  const last = changes[changes.length - 1];
  return `Updated ${changes.slice(0, -1).join(", ")}, and ${last}`;
}
