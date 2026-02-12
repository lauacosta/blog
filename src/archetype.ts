export type Archetype = {
  title: string;
  published: boolean;
  abstract: string;
  tags: Array<string>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isArchetype(value: unknown): value is Archetype {
  if (!isObject(value)) return false;

  const keys = Object.keys(value);
  if (
    !["title", "published", "abstract", "tags"].every((k) => keys.includes(k))
  ) {
    return false;
  }

  return (
    typeof value.title === "string" &&
    typeof value.published === "boolean" &&
    typeof value.abstract === "string" &&
    Array.isArray(value.tags) &&
    value.tags.every((t) => typeof t === "string")
  );
}

export const Archetype = {
  parse(text: string): { arch: Archetype; body: string } {
    const match = text.match(/^---\n([\s\S]*?)\n---\n?/);

    if (!match) {
      throw new Error("The post is missing an archetype!");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(match[1]);
    } catch {
      throw new Error("Invalid JSON in archetype");
    }

    if (!isArchetype(parsed)) {
      throw new Error("Invalid archetype shape");
    }

    const arch = parsed;

    if (!arch.title.trim()) {
      throw new Error("Title cannot be empty");
    }

    if (!arch.abstract.trim()) {
      throw new Error("Abstract cannot be empty");
    }

    const number_of_words =
      arch.abstract.trim().split(/\s+/).filter(Boolean).length;

    if (number_of_words > 100) {
      throw new Error("The abstract for that post is way too long");
    }

    if (arch.tags.length === 0) {
      throw new Error("Tags cannot be empty");
    }

    const body = text.slice(match[0].length);

    return { arch, body };
  },
};
