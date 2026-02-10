// Based on https://github.com/matklad/matklad.github.io/blob/caf0614156a379abffc4491b46aae8a872ac939f/src/tsx.ts
/** @jsx h */
/** @jsxFrag Fragment */
// deno-lint-ignore-file no-explicit-any
import { escapeHtml, h, Raw, render, VNode } from "./tsx.ts";
import { to_lower_snake_case } from "./utils.ts";
import { Post as PostData } from "./main.ts";

const site_url = "https://lautaroacosta.com";
const github_url = "https://github.com/lauacosta";
const blurb = "Lautaro's Coppermind";
const private_html =
  `<aside class="admn private"><svg class="icon"><use href="/assets/icons.svg#private"></use></svg><div><p>If you found this you are a beta reader or really lucky! This article is not yet ready to be made public :)</p></div></aside>`;

export function html_ugly(node: VNode, doctype = "<!DOCTYPE html>"): string {
  return `${doctype}\n${render(node)}`;
}

function Fonts() {
  const style = `
@font-face {
  font-family: 'Iosevka';
  src: url('/css/Iosevka-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Ornaments';
  src: url('/css/ornaments.woff2') format('woff2');
  font-display: swap;
}

@font-face {
  font-family: 'Inter';
  src: url('/css/Inter-Light.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'Montserrat';
  src: url('/css/Montserrat-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'et-book';
  src: url('/css/etbookot-roman-webfont.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'et-book';
  src: url('/css/etbookot-italic-webfont.woff2') format('woff2');
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}

@font-face {
  font-family: 'et-book';
  src: url('/css/etbookot-bold-webfont.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}`;
  return (
    <style>
      <Raw unsafe={style} />
    </style>
  );
}

function Base({ children, published, description, title, path, extra_css, date, src }: {
  children?: VNode[];
  src: string;
  description: string;
  title: string;
  published?: boolean;
  path: string;
  date?: string;
  extra_css?: string;
}) {
  const snake_case_title = to_lower_snake_case(title);
  const og_image_path = date ? `og-${snake_case_title}-d1d3.png` : "og.png";
  const def_title = date ? `${title} - Lautaro Acosta Quintana` : title;

  return (
    <html lang="en-US">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{def_title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${site_url}${path}`} />

        <meta property="og:type" content="article" />
        <meta property="og:title" content={def_title} />
        <meta property="og:image" content={`https://cdn.lautaroacosta.com/${og_image_path}`} />
        <meta property="og:image:width" content="1260" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="en-us" />
        <meta property="og:url" content={`${site_url}${path}`} />
        <meta property="og:description" content={description} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={def_title} />
        <meta name="twitter:image" content={`https://cdn.lautaroacosta.com/${og_image_path}`} />

        <meta name="twitter:description" content={description} />

        {date && <meta property="article:published_time" content={date} />}
        <meta name="author" content="Lautaro Acosta Quintana" />

        <link rel="icon" href="https://cdn.lautaroacosta.com/favicon.png" type="image/png" />
        <link rel="icon" href="https://cdn.lautaroacosta.com/favicon.svg" type="image/svg+xml" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="blog"
          href={`${site_url}/feed.xml`}
        />
        <Fonts />
        <link rel="stylesheet" href="/css/main.css" />
        {extra_css && <link rel="stylesheet" href={`/css/${extra_css}`} />}
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="1a3b8e55-3994-441d-91dd-046777264961"
        >
        </script>
      </head>
      <body>
        {date && (
          <div class="progress-container">
            <div class="progress-bar"></div>
          </div>
        )}

        <header>
          <nav>
            <a class="title" href="/">Lautaro's Coppermind</a>
            <a href="/about.html">About</a>
            <a href="/blogroll.html">Blogroll</a>
            <a id="home-page-top" href="#home-page-top"></a>
            <input type="checkbox" id="theme-toggle" hidden />
            <label for="theme-toggle" class="theme-toggle" aria-label="Toggle theme"></label>
          </nav>
        </header>

        {published &&
          <Raw unsafe={private_html} />}

        <main>
          {children}
        </main>

        <footer>
          {date && (
            <p class="meta-links">
              (<a class="emphasis" href={`${github_url}/blog/commits/master${src}`}>
                revision history
              </a>{" "}
              & <a class="emphasis" href="/ai_transparency.html">AI transparency</a>)
            </p>
          )}
          <p>
            <a href="/feed.xml">
              <FooterIcon name="rss" />
              RSS
            </a>
            <a href="mailto:lautaro+blog@lautaroacosta.com">
              <FooterIcon name="email" />
              Send an email
            </a>

            <a href="https://linkedin.com/in/lautaro-acosta-quintana">
              <FooterIcon name="linkedin" />
              LinkedIn
            </a>

            <a href={github_url}>
              <FooterIcon name="github" />
              lauacosta
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}

function FooterIcon({ name }: { name: string }) {
  return (
    <svg>
      <use href={`/assets/icons.svg#${name}`} />
    </svg>
  );
}

export function Page(name: string, content: HtmlString) {
  return (
    <Base
      path={`/${name}`}
      title="Lautaro Acosta Quintana"
      src={`/content/${name}.dj`}
      description={blurb}
    >
      <Raw unsafe={content.value} />
    </Base>
  );
}

export function PostList({ posts }: { posts: PostData[] }) {
  const list_items = posts.map((post) => (
    <li>
      <Time className="meta" date={post.iso_date} />
      <span class="reading-time">
        {post.reading_time_mins} min read
      </span>
      <h2>
        <a href={post.path}>{post.title}</a>
      </h2>
    </li>
  ));

  return (
    <Base path="" title="Lautaro Acosta Quintana" description={blurb} src="/src/templates.tsx">
      <ul class="post-list">
        {list_items}
      </ul>
    </Base>
  );
}

export function Post({ post }: { post: PostData }) {
  const match = post.content.value.match(/<p>(.*?)<\/p>/i);
  const description = match
    ? match[1].replace(/<[^>]+>/g, "")
      .trim()
    : blurb;

  let tocHtml = "";
  if (post.toc) {
    const titles = post.toc.titles;
    tocHtml =
      '<nav class="table-of-contents"><menu><a class="toc-entry" href="#home-page-top"><h2 class="toc-header">Contents</h2></a>' +
      titles.map(({ id, level, title }) =>
        `<li data-level=${level}>
          ${id ? `<a href="#${id}">${title}</a>` : title}
        </li>`
      ).join("") +
      "</menu></nav>";
  }

  return (
    <Base
      src={post.src}
      title={post.title}
      path={post.path}
      published={post.published}
      date={post.iso_date.toISOString()}
      description={description}
    >
      {tocHtml && <Raw unsafe={tocHtml} />}
      <div>
        <article>
          <Raw unsafe={post.content.value} />
        </article>
      </div>
    </Base>
  );
}

function Time(
  { date, className = undefined }: { date: Date; className?: string },
) {
  const human = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const machine = yyyy_mm_dd(date);
  return <time class={className} datetime={machine}>{human}</time>;
}
function yyyy_mm_dd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function time_html(date: Date, className: string) {
  return render(<Time date={date} className={className} />);
}

export function Redirect({ path }: { path: string }) {
  return (
    <html lang="en-US">
      <meta charset="utf-8" />
      <title>Redirecting…</title>
      <link rel="canonical" href={path} />
      <script>
        <Raw unsafe={`location="${path}"`} />
      </script>
      <meta http-equiv="refresh" content={`0; url=${path}`} />
      <meta name="robots" content="noindex" />
      <h1>Redirecting…</h1>
      <a href={path}>Click here if you are not redirected.</a>
    </html>
  );
}

export function feed_xml(posts: PostData[]): string {
  return html_ugly(
    Feed({ posts }),
    `<?xml version="1.0" encoding="utf-8"?>`,
  );
}

function Feed({ posts }: { posts: PostData[] }) {
  const entries = posts.slice(0, 10).map((post) => FeedEntry({ post }));

  return (
    <feed xmlns="http://www.w3.org/2005/Atom">
      <link
        href={`${site_url}/feed.xml`}
        rel="self"
        type="application/atom+xml"
      />
      <link href={site_url} rel="alternate" type="text/html" />
      <updated>{new Date().toISOString()}</updated>
      <id>{`${site_url}/feed.xml`}</id>
      <title type="html">{blurb}</title>
      <subtitle>{blurb}</subtitle>
      <author>
        <name>Lautaro Acosta Quintana</name>
      </author>
      {entries}
    </feed>
  );
}

function FeedEntry({ post }: { post: PostData }) {
  return (
    <entry>
      <title type="text">{post.title}</title>
      <link
        href={`${site_url}${post.path}`}
        rel="alternate"
        type="text/html"
        title={post.title}
      />
      <published>{yyyy_mm_dd(post.iso_date)}T00:00:00+00:00</published>
      <updated>{yyyy_mm_dd(post.iso_date)}T00:00:00+00:00</updated>
      <id>{`${site_url}${post.path.replace(".html", "")}`}</id>
      <author>
        <name>Lautaro Acosta Quintana</name>
      </author>
      <content type="html" xml:base={`${site_url}${post.path}`}>
        <Raw unsafe={`<![CDATA[${post.content.value}]]>`} />
      </content>
    </entry>
  );
}

export function html(
  strings: ArrayLike<string>,
  ...values: any[]
): HtmlString {
  function content(value: any): string[] {
    if (value === undefined) return [];
    if (value instanceof HtmlString) return [value.value];
    if (Array.isArray(value)) return value.flatMap(content);
    return [escapeHtml(value)];
  }
  return new HtmlString(
    String.raw({ raw: strings }, ...values.map((it) => content(it).join(""))),
  );
}

export class HtmlString {
  constructor(public value: string) {
  }
  push(other: HtmlString) {
    this.value = `${this.value}\n${other.value}`;
  }
}
