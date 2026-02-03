import { html, HtmlString } from "./templates.tsx";
import { Language, Parser, Query } from "npm:web-tree-sitter";

const parsers = new Map<string, Parser>();
const queries = new Map<string, Query>();
let initialized = false;

const LANG_CONFIGS = {
  rust: {
    wasmPath: new URL("../contents/assets/tree-sitter-rust.wasm", import.meta.url),
    queryPath: new URL("../contents/assets/queries/highlights-rust.scm", import.meta.url),
  },
  java: {
    wasmPath: new URL("../contents/assets/tree-sitter-java.wasm", import.meta.url),
    queryPath: new URL("../contents/assets/queries/highlights-java.scm", import.meta.url),
  },
  go: {
    wasmPath: new URL("../contents/assets/tree-sitter-go.wasm", import.meta.url),
    queryPath: new URL("../contents/assets/queries/highlights-go.scm", import.meta.url),
  },
  typescript: {
    wasmPath: new URL("../contents/assets/tree-sitter-typescript.wasm", import.meta.url),
    queryPath: new URL("../contents/assets/queries/highlights-typescript.scm", import.meta.url),
  },
  c: {
    wasmPath: new URL("../contents/assets/tree-sitter-c.wasm", import.meta.url),
    queryPath: new URL("../contents/assets/queries/highlights-c.scm", import.meta.url),
  },
  bash: {
    wasmPath: new URL("../contents/assets/tree-sitter-bash.wasm", import.meta.url),
    queryPath: new URL("../contents/assets/queries/highlights-bash.scm", import.meta.url),
  },
};

export async function initTreeSitter() {
  if (initialized) return;

  await Parser.init();

  for (const [langName, config] of Object.entries(LANG_CONFIGS)) {
    try {
      const parser = new Parser();
      const lang = await Language.load(config.wasmPath);
      parser.setLanguage(lang);

      const queryText = await Deno.readTextFile(config.queryPath);

      const query = new Query(lang, queryText);

      parsers.set(langName, parser);
      queries.set(langName, query);

      console.log(`✓ Loaded tree-sitter grammar for ${langName}`);
    } catch (e) {
      console.warn(`Failed to load tree-sitter grammar for ${langName}:`, e);
    }
  }

  initialized = true;
}

function getParser(language: string): { parser: Parser; query: Query } | null {
  if (!initialized) {
    console.warn("Tree-sitter not initialized. Call initTreeSitter() first.");
    return null;
  }

  const parser = parsers.get(language);
  const query = queries.get(language);

  if (!parser || !query) return null;

  return { parser, query };
}

export function highlight(
  source: string,
  language?: string,
  highlight_spec?: string,
): HtmlString {
  const spec = parse_highlight_spec(highlight_spec);

  let src = source;
  let callouts: Map<number, number[]>;
  [src, callouts] = parse_callouts(src);

  let highlighted: string = add_spans(src, language).value;
  highlighted = highlighted.trimEnd();

  const openTags: string[] = [];
  highlighted = highlighted.replace(
    /(<span [^>]+>)|(<\/span>)|(\n)/g,
    (match) => {
      if (match === "\n") {
        return "</span>".repeat(openTags.length) + "\n" + openTags.join("");
      }

      if (match === "</span>") {
        openTags.pop();
      } else {
        openTags.push(match);
      }

      return match;
    },
  );

  const lines = highlighted.split("\n").map((it, idx) => {
    const cls = spec.includes(idx + 1) ? " hl-line" : "";
    const calls = (callouts.get(idx) ?? [])
      .map((it) => `<i class="callout" data-value="${it}"></i>`)
      .join(" ");
    return `<span class="line${cls}">${it}${calls}</span>`;
  }).join("\n");

  return html`
    <pre><code>${new HtmlString(lines)}</code></pre>
  `;
}

function add_spans(source: string, language?: string): HtmlString {
  if (!language || language === "adoc") {
    return html`
      ${escapeHtml(source)}
    `;
  }
  if (language === "console") return add_spans_console(source);

  try {
    const result = getParser(language);
    if (!result) {
      console.warn(`No tree-sitter grammar for language: ${language}`);
      return html`
        ${escapeHtml(source)}
      `;
    }

    const { parser, query } = result;
    const tree = parser.parse(source);
    const captures = query.captures(tree.rootNode);

    const tokens: Array<{ start: number; end: number; class: string }> = [];

    for (const capture of captures) {
      tokens.push({
        start: capture.node.startIndex,
        end: capture.node.endIndex,
        class: `hl-${capture.name.replaceAll(".", "-")}`,
      });
    }

    tokens.sort((a, b) => a.start - b.start || b.end - a.end);

    let html = "";
    let pos = 0;
    const stack: Array<{ end: number; class: string }> = [];

    for (const token of tokens) {
      if (token.start < pos) continue;

      while (stack.length > 0 && stack[stack.length - 1].end <= token.start) {
        const closed = stack.pop()!;
        html += escapeHtml(source.slice(pos, closed.end)) + "</span>";
        pos = closed.end;
      }

      if (pos < token.start) {
        html += escapeHtml(source.slice(pos, token.start));
        pos = token.start;
      }

      html += `<span class="${token.class}">`;
      stack.push(token);
    }

    while (stack.length > 0) {
      const closed = stack.pop()!;
      html += escapeHtml(source.slice(pos, closed.end)) + "</span>";
      pos = closed.end;
    }

    if (pos < source.length) {
      html += escapeHtml(source.slice(pos));
    }

    return new HtmlString(html);
  } catch (e) {
    console.error(e);
    console.error(`\n    tree-sitter failed for language=${language}\n`);
    return html`
      ${escapeHtml(source)}
    `;
  }
}

function add_spans_console(source: string): HtmlString {
  let cont = false;
  const lines = source.trimEnd().split("\n").map((line) => {
    if (cont) {
      cont = line.endsWith("\\");
      return html`
        ${line}\\n
      `;
    }
    if (line.startsWith("$ ")) {
      cont = line.endsWith("\\");
      return html`
        <span class="hl-title function_">$</span> ${line.substring(2)}\\n
      `;
    }
    if (line.startsWith("#")) {
      return html`
        <span class="hl-comment">${line}</span>\\n
      `;
    }
    return html`
      <span class="hl-output">${line}</span>\\n
    `;
  });
  return html`
    ${lines}
  `;
}

function parse_highlight_spec(spec?: string): number[] {
  if (!spec) return [];
  return spec.split(",").flatMap((el) => {
    if (el.includes("-")) {
      const [los, his] = el.split("-");
      const lo = parseInt(los, 10);
      const hi = parseInt(his, 10);
      return Array.from({ length: (hi - lo) + 1 }, (_x, i) => lo + i);
    }
    return [parseInt(el, 10)];
  });
}

function parse_callouts(source: string): [string, Map<number, number[]>] {
  const res: Map<number, number[]> = new Map();
  let line = 0;
  const without_callouts = source.replace(/<(\d)>|\n/g, (m, d) => {
    if (m === "\n") {
      line += 1;
      return m;
    }
    const arr = res.get(line) ?? [];
    arr.push(d);
    res.set(line, arr);
    return "";
  });
  return [without_callouts, res];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
