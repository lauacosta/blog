import * as debounce from "@std/async/debounce";
import {
  AssertAllCommandsHandled,
  boolean,
  defineCli,
  defineCommand,
  parseCli,
  string,
} from "./cli.ts";
import * as djot from "./djot.ts";
import { feed_xml, html_ugly, HtmlString, Page, Post, PostList } from "./templates.tsx";
import { initTreeSitter } from "./tree_sitter.ts";
import { to_lower_snake_case, to_title_case } from "./utils.ts";

const ARCHETYPE_REGEX = /^---\s*([\s\S]*?)\s*---\s*/;

const cli_schema = defineCli({
  description: "Tool to make my life better",
  commands: {
    draft: defineCommand({
      name: "draft",
      description: "Create a new .dj file in the /posts folder to start writing an article",
      args: {
        title: string(),
      },
      options: {
        private: boolean({ default: true }),
      },
    }),
    watch: defineCommand({
      name: "watch",
      description: "spawns miniserver to preview the results of the build. Rebuilds on change",
      options: {
        profile: boolean({ default: false }),
        clean: boolean({ default: false }),
      },
    }),
    spell: defineCommand({
      name: "spell",
      description: "Spell checks the newest post with `wiz`",
    }),
    build: defineCommand({
      name: "build",
      description: "Does a lot of things to publish",
      options: {
        profile: boolean({ default: false }),
        clean: boolean({ default: false }),
      },
    }),
  },
});

async function main() {
  const cli = parseCli(cli_schema);
  console.debug(cli);

  if (cli.command === "draft") {
    draft(cli.args.title, cli.options.private ?? true);
    return;
  }

  if (cli.command === "build") {
    await initTreeSitter();
    const profile = cli.options.profile ?? false;
    const clean = cli.options.clean ?? true;
    await build(clean, profile);
    return;
  }

  if (cli.command === "watch") {
    await initTreeSitter();
    const profile = cli.options.profile ?? false;
    const clean = cli.options.clean ?? true;
    await watch(clean, profile);
    return;
  }

  if (cli.command === "spell") {
    await spell();
    return;
  }

  // INFO: Makes the LSP angry if I dont handle all the variants.
  // FIXME: Always complains when only one command is defined even if it is handled because of the type inferred in `cli` when that is the case.
  const _exhaustiveCheck: AssertAllCommandsHandled<typeof cli> = cli;
  throw new Error(`Unhandled command`);
}

class Ctx {
  constructor(
    public read_ms: number = 0,
    public parse_ms: number = 0,
    public render_ms: number = 0,
    public collect_ms: number = 0,
    public fmt_ms: number = 0,
    public total_ms: number = 0,
  ) {}

  print_stats() {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(this)) {
      if (typeof value !== "number") continue;
      if (!key.endsWith("_ms")) continue;

      const label = key.slice(0, -3);
      parts.push(`${label}=${value.toFixed(2)}ms`);
    }

    console.log(`\n${parts.join(" ")}`);
  }
}

async function spell() {
  const postsDir = "./contents/posts";
  const entries: { path: string; date: Date }[] = [];

  for await (const entry of Deno.readDir(postsDir)) {
    if (entry.isFile && entry.name.endsWith(".dj")) {
      const match = entry.name.match(/^(\d{4}-\d{2}-\d{2})-/);
      if (match) {
        entries.push({
          path: `${postsDir}/${entry.name}`,
          date: new Date(match[1]),
        });
      }
    }
  }

  if (entries.length === 0) {
    console.error("No dated posts found in content/posts");
    return;
  }

  entries.sort((a, b) => b.date.getTime() - a.date.getTime());

  const newest = entries[0].path;

  console.log(`Running wiz spell on: ${newest}\n`);

  const cmd = new Deno.Command("wiz", {
    args: ["spell", newest],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();

  const decoder = new TextDecoder();

  if (code !== 0) {
    console.error(decoder.decode(stderr));
    return;
  }

  console.log(decoder.decode(stdout));
}

async function draft(name: string, priv: boolean) {
  const title = to_title_case(name);

  const date = new Date().toISOString().split("T")[0];
  const slug = to_lower_snake_case(title);
  const path = `./contents/posts/${date}-${slug}.dj`;

  console.log(`drafted post ${path}`);
  const arch = JSON.stringify({
    title,
    private: priv,
  });

  await Deno.writeTextFile(path, `---\n ${arch} \n---\n #${title}\n`);
}

async function build(clean: boolean, profile: boolean) {
  const t = performance.now();
  const ctx = new Ctx();

  if (clean) {
    try {
      await Deno.remove("./dist/", { recursive: true });
    } catch (err) {
      if (!(err instanceof Deno.errors.NotFound)) {
        throw err;
      }
    }
  }
  await Deno.mkdir("./dist/", { recursive: true });

  const posts = await collect_posts(ctx);
  for (const post of posts) {
    await update_file(
      `dist/${post.path}`,
      html_ugly(Post({ post })),
    );
  }
  const public_posts = posts.filter((p) => !p.private);

  await update_file("./dist/index.html", html_ugly(PostList({ posts: public_posts })));
  await update_file("./dist/feed.xml", feed_xml(public_posts));

  const pages = ["about", "blogroll", "ai_transparency", "style_guidelines"];
  for (const page of pages) {
    const text = await Deno.readTextFile(`contents/${page}.dj`);
    const ast = djot.parse(text);
    const html = djot.render(ast, {});
    await update_file(
      `dist/${page}.html`,
      html_ugly(Page(page, html)),
    );
  }
  const paths = [
    "css/*",
    "assets/*",
  ];
  for (const path of paths) {
    await update_path(path);
  }

  const t_fmt = performance.now();
  await new Deno.Command(Deno.execPath(), {
    args: ["fmt", "./dist"],
  }).output();
  ctx.fmt_ms = performance.now() - t_fmt;

  ctx.total_ms = performance.now() - t;

  if (profile) {
    ctx.print_stats();
  }
}

function dirname(path: string): string {
  return path.substring(0, path.lastIndexOf("/"));
}

async function update_file(path: string, content: Uint8Array | string) {
  if (!content) return;
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.mkdir("./dist/tmp", { recursive: true });
  const temp = await Deno.makeTempFile({ dir: "./dist/tmp" });
  if (content instanceof Uint8Array) {
    await Deno.writeFile(temp, content);
  } else {
    await Deno.writeTextFile(temp, content);
  }
  await Deno.rename(temp, path);
}

async function update_path(path: string) {
  if (path.endsWith("*")) {
    const dir = path.replace("*", "");
    const futs = [];
    for await (const entry of Deno.readDir(`contents/${dir}`)) {
      if (entry.isFile) {
        futs.push(update_path(`${dir}/${entry.name}`));
      }
    }
    await Promise.all(futs);
  } else {
    await update_file(
      `dist/${path}`,
      await Deno.readFile(`contents/${path}`),
    );
  }
}

type Archetype = { title: string; private: boolean };
function parse_archetype(text: string): { arch: Archetype; body: string } {
  const match = text.match(ARCHETYPE_REGEX);

  if (!match) {
    throw new Error("The post is missing an archetype");
  }

  const arch: Archetype = JSON.parse(match[1]);
  const body = text.slice(match[0].length);

  return { arch, body };
}

export type Toc = {
  titles: {
    id: string;
    level: number;
    title: string;
  }[];
};

export type Post = {
  title: string;
  year: number;
  month: number;
  day: number;
  reading_time_mins: number;
  iso_date: Date;
  toc?: Toc;
  private: boolean;
  slug: string;
  content: HtmlString;
  path: string;
  src: string;
};

async function collect_posts(ctx: Ctx): Promise<Post[]> {
  const start = performance.now();
  const posts: Post[] = [];

  for await (const path of walk_dir("./contents/posts/")) {
    if (!path.endsWith(".dj")) continue;

    const [, y, m, d, slug] = path.match(
      /^.*(\d\d\d\d)-(\d\d)-(\d\d)-(.*)\.dj$/,
    )!;
    const [year, month, day] = [y, m, d].map((it) => parseInt(it, 10));
    const date = new Date(Date.UTC(year, month - 1, day));

    let t = performance.now();
    const raw = await Deno.readFile(path);
    const text = new TextDecoder().decode(raw);
    const { arch, body } = parse_archetype(text);

    ctx.read_ms += performance.now() - t;

    t = performance.now();
    const ast = djot.parse(body);
    ctx.parse_ms += performance.now() - t;

    t = performance.now();
    const render_ctx = { date, summary: undefined, title: undefined };

    const reading_time_mins = djot.estimate_reading_time(ast);
    // const toc = djot.build_table_contents(ast);
    const html = djot.render(ast, render_ctx, reading_time_mins);

    ctx.render_ms += performance.now() - t;

    const src = `/contents/posts/${y}-${m}-${d}-${slug}.dj`;
    console.log(`Post collected: ${src}`);

    posts.push({
      year,
      month,
      reading_time_mins,
      day,
      slug,
      // toc,
      iso_date: date,
      title: arch.title,
      private: arch.private,
      content: html,
      path: `/${y}/${m}/${d}/${slug}.html`,
      src: src,
    });
  }
  posts.sort((l, r) => l.path < r.path ? 1 : -1);
  ctx.collect_ms = performance.now() - start;
  return posts;
}

async function* walk_dir(dir: string): AsyncIterableIterator<string> {
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory) {
      yield* walk_dir(path);
    } else {
      yield path;
    }
  }
}

async function watch(clean: boolean, profile: boolean) {
  let signal = Promise.withResolvers();
  (async () => {
    let build_id = 0;
    while (await signal.promise) {
      signal = Promise.withResolvers();
      console.log(`rebuild #${build_id}`);
      build_id += 1;
      await build(
        clean,
        profile,
      );
    }
  })();

  signal.resolve(true);

  const rebuild_debounced = debounce.debounce(
    () => signal.resolve(true),
    16,
  );

  for await (const event of Deno.watchFs("./contents", { recursive: true })) {
    if (event.kind == "access") continue;
    await rebuild_debounced();
  }
  signal.resolve(false);
}

if (import.meta.main) await main();
