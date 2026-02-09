// Based on https://github.com/matklad/matklad.github.io/blob/caf0614156a379abffc4491b46aae8a872ac939f/src/djot.tsdjot
import { highlight } from "./tree_sitter.ts";
import { HtmlString, time_html } from "./templates.tsx";

import { parse as djot_parse } from "@djot/parse.ts";
import { HTMLRenderer, renderHTML } from "@djot/html.ts";
import {
  AstNode,
  BlockQuote,
  CodeBlock,
  Div,
  Doc,
  Footnote,
  FootnoteReference,
  HasAttributes,
  Heading,
  Image,
  Link,
  OrderedList,
  Para,
  Section,
  Span,
  Str,
  Url,
  Visitor,
} from "@djot/ast.ts";
import { Toc } from "./main.ts";

export function parse(source: string): Doc {
  return djot_parse(source);
}

type RenderCtx = {
  date?: Date;
  summary?: string;
  title?: string;
};

export function estimate_reading_time(doc: Doc): number {
  let words = 0;
  let images = 0;
  let code_blocks = 0;

  function visit(node: AstNode) {
    switch (node.tag) {
      case "str": {
        const t = node.text.trim();
        if (t) words += t.split(/\s+/).length;
        break;
      }
      case "image":
        images += 1;
        break;
      case "code_block":
        code_blocks += 1;
        return;
    }

    if ("children" in node) {
      for (const c of node.children) visit(c);
    }
  }

  visit(doc);

  return Math.ceil(
    words / 225 +
      images * 0.17 +
      code_blocks * 0.5,
  );
}

export function build_table_contents(doc: Doc): Toc {
  let counter = 1;
  const headings: { id: string; title: string; level: number }[] = [];

  function visit(node: AstNode) {
    switch (node.tag) {
      case "heading": {
        const level = node.level;
        let title = "";
        if (level > 1) {
          title = get_string_content(node);
        }

        if (title) {
          const slug = title
            .replace(/\s+/g, "-")
            .replace(/[^\w\-]+/g, "")
            .replace(/\-\-+/g, "-")
            .replace(/^-+/, "")
            .replace(/-+$/, "");

          headings.push({ id: slug, title, level });
          counter++;
        }

        break;
      }
    }

    if ("children" in node) {
      for (const c of node.children) visit(c);
    }
  }

  visit(doc);

  return { titles: headings };
}

export function render(
  doc: Doc,
  ctx: RenderCtx,
  reading_time_mins?: number,
): HtmlString {
  let section: Section | undefined = undefined;
  let documentSideNotes: Record<string, Footnote> = {};

  const overrides: Visitor<HTMLRenderer, string> = {
    section: (node: Section, r: HTMLRenderer): string => {
      const section_prev = section;
      section = node;
      const result = get_child(node, "heading")?.level == 1
        ? r.renderChildren(node)
        : r.renderAstNodeDefault(node);
      section = section_prev;
      return result;
    },
    heading: (node: Heading, r: HTMLRenderer) => {
      if (node.level === 1) ctx.title = get_string_content(node);

      if (node.level === 1) {
        const children = r.renderChildren(node);

        const date_html = ctx.date ? time_html(ctx.date, "meta") : "";

        const reading_html = reading_time_mins
          ? `<span class="reading-time">
           ${reading_time_mins} min read
         </span>`
          : "";

        return `<header>
      <h1${r.renderAttributes(node)}>${children}</h1>
      ${date_html}${reading_html}
    </header>`;
      }

      const tag = `h${node.level}`;
      const id = node.level > 1 && section?.autoAttributes?.id;
      const children = r.renderChildren(node);
      const children_anchored = id ? `<a href="#${id}">${children}</a>` : children;

      return `\n<${tag}${r.renderAttributes(node)}>${children_anchored}</${tag}>\n`;
    },
    ordered_list: (node: OrderedList, r: HTMLRenderer): string => {
      if (node.style === "1)") add_class(node, "callout");
      return r.renderAstNodeDefault(node);
    },
    link: (node: Link, r: HTMLRenderer) => {
      const destination = node.destination;
      if (destination) {
        const isInternal = destination.startsWith("/") ||
          destination.startsWith("#") ||
          destination.startsWith("./") ||
          destination.startsWith("../") ||
          (!destination.startsWith("http://") && !destination.startsWith("https://"));

        if (isInternal) {
          const attrs = node.attributes || {};
          attrs.class = attrs.class ? `${attrs.class} internal-link` : "internal-link";
          node.attributes = attrs;
        }
      }

      return r.renderAstNodeDefault(node);
    },
    para: (node: Para, r: HTMLRenderer) => {
      if (node.children.length == 1 && node.children[0].tag == "image") {
        let cap = extract_cap(node);
        if (cap) {
          cap = `<figcaption class="title">${cap}</figcaption>\n`;
        } else {
          cap = "";
        }

        return `<figure${r.renderAttributes(node)}>${cap}${r.renderChildren(node)}</figure>`;
      }
      const result = r.renderAstNodeDefault(node);
      if (!ctx.summary) ctx.summary = get_string_content(node);
      return result;
    },
    block_quote: (node: BlockQuote, r: HTMLRenderer) => {
      let source = undefined;
      if (node.children.length > 0) {
        const last_child: { tag: string; children?: AstNode[] } =
          node.children[node.children.length - 1];
        if (
          last_child.tag != "thematic_break" &&
          last_child?.children?.length == 1 &&
          last_child?.children[0].tag == "link"
        ) {
          source = last_child.children[0];
          node.children.pop();
        }
      }
      const cite = source ? `<figcaption><cite>${r.renderAstNode(source)}</cite></figcaption>` : "";

      return `<figure class="blockquote"><blockquote>${
        r.renderChildren(node)
      }</blockquote>${cite}</figure>
`;
    },
    div: (node: Div, r: HTMLRenderer): string => {
      let admon_icon = "";
      if (has_class(node, "info")) admon_icon = "info";
      if (has_class(node, "warn")) admon_icon = "warn";
      // if (has_class(node, "private")) admon_icon = "private";
      if (has_class(node, "danger")) admon_icon = "danger";

      if (admon_icon) {
        return `<aside${
          r.renderAttributes(node, { "class": "admn" })
        }><svg class="icon"><use href="/assets/icons.svg#${admon_icon}"/></svg><div>${
          r.renderChildren(node)
        }</aside>`;
      }

      if (has_class(node, "block")) {
        let cap = extract_cap(node);
        if (cap) {
          cap = `<div class="title">${cap}</div>`;
        } else {
          cap = "";
        }
        return `<aside${r.renderAttributes(node)}>${cap}${r.renderChildren(node)}</aside>`;
      }

      if (has_class(node, "details")) {
        return `<details><summary>${extract_cap(node)}</summary>${
          r.renderChildren(node)
        }</details>`;
      }

      return r.renderAstNodeDefault(node);
    },
    code_block: (node: CodeBlock) => {
      let cap = extract_cap(node);
      if (cap) {
        cap = `<figcaption class="title">${cap}</figcaption>\n`;
      } else {
        cap = "";
      }

      const pre = highlight(
        node.text,
        node.lang,
        attr(node, "highlight"),
      ).value.trim();

      return `<figure class="code-block">${cap}${pre}</figure>`;
    },
    image: (node: Image, r: HTMLRenderer): string => {
      if (has_class(node, "video")) {
        if (!node.destination) throw "missing destination";
        if (has_class(node, "loop")) {
          return `<video src="${node.destination}" autoplay muted=true loop=true></video>`;
        } else {
          return `<video src="${node.destination}" controls muted=true></video>`;
        }
      }
      return r.renderAstNodeDefault(node);
    },
    span: (node: Span, r: HTMLRenderer) => {
      if (has_class(node, "code")) {
        const children = r.renderChildren(node);
        return `<code>${children}</code>`;
      }
      if (has_class(node, "dfn")) {
        const children = r.renderChildren(node);
        return `<dfn>${children}</dfn>`;
      }
      if (has_class(node, "kbd")) {
        const children = get_string_content(node)
          .split("+")
          .map((it) => `<kbd>${it}</kbd>`)
          .join("+");
        return `<kbd>${children}</kbd>`;
      }

      return r.renderAstNodeDefault(node);
    },
    str: (node: Str, r: HTMLRenderer) => {
      if (has_class(node, "dfn")) {
        return `<dfn>${node.text}</dfn>`;
      }
      return r.renderAstNodeDefault(node);
    },
    url: (node: Url, r: HTMLRenderer) => {
      add_class(node, "url");
      return r.renderAstNodeDefault(node);
    },

    doc: (node: Doc, r: HTMLRenderer) => {
      documentSideNotes = node.footnotes;
      return r.renderAstNodeDefault(node);
    },

    footnote_reference: (node: FootnoteReference, r: HTMLRenderer) => {
      let result = "";
      const label = node.text;
      if (documentSideNotes[label]) {
        // I track the footnote but don't increment the next index so the endnotes are not rendered when `doc` is rendered.
        let index = r.footnoteIndex[label];
        if (!index) {
          index = Object.keys(r.footnoteIndex).length + 1;
          r.footnoteIndex[label] = index;
        }

        const refId = `sn-${index}`;
        result += `<label for="${refId}" class="margin-toggle sidenote-number"></label>`;
        result += `<input type="checkbox" id="${refId}" class="margin-toggle"/>`;
        result += `<span class="sidenote-content">`;
        const footnoteNode = documentSideNotes[label];
        if (footnoteNode.children) {
          for (const child of footnoteNode.children) {
            let childContent = r.renderAstNode(child);
            childContent = childContent.replace(/<\/?p>/g, "");
            result += childContent;
          }
        }
        result += `</span>`;
      }

      return result;
    },

    footnote: (_node: Footnote, _r: HTMLRenderer) => {
      return "";
    },
  };

  return new HtmlString(renderHTML(doc, { overrides }));
}

type AstTag = AstNode["tag"];

function get_child<Tag extends AstTag>(
  node: AstNode,
  tag: Tag,
): Extract<AstNode, { tag: Tag }> | undefined {
  for (const child of (node as { children?: AstNode[] })?.children ?? []) {
    if (child.tag == tag) return child as Extract<AstNode, { tag: Tag }>;
  }
  return undefined;
}

function has_class(node: AstNode, cls: string): boolean {
  const classes = attr(node, "class") ?? "";
  return classes.split(" ").includes(cls);
}

function add_class(node: AstNode, cls: string) {
  const classes = attr(node, "class");
  setattr(node, "class", classes ? `${classes} ${cls}` : cls);
}

function extract_cap(node: AstNode): string | undefined {
  const cap = attr(node, "cap");
  if (cap) {
    delete node.attributes!.cap;
    return cap;
  }
}

function attr(node: HasAttributes, name: string): string | undefined {
  return node.attributes ? node.attributes[name] : undefined;
}

function setattr(node: HasAttributes, name: string, value: string) {
  node.attributes = node.attributes || {};
  node.attributes[name] = value;
}

const get_string_content = function (node: AstNode): string {
  const buffer: string[] = [];
  add_string_content(node, buffer);
  return buffer.join("");
};

const add_string_content = function (
  node: AstNode,
  buffer: string[],
): void {
  if ("text" in node) {
    buffer.push(node.text);
  } else if (
    "tag" in node &&
    (node.tag === "soft_break" || node.tag === "hard_break")
  ) {
    buffer.push("\n");
  } else if ("children" in node) {
    for (const child of node.children) {
      add_string_content(child, buffer);
    }
  }
};
