// deno-lint-ignore-file no-explicit-any
import { parseFeed } from "@rss";
import { NowHHMMSS } from "./http_server.ts";

export interface FeedEntry {
  author?: string;
  title: string;
  url: string;
  date: Date;
}

export const Blogroll = {
  async create(): Promise<FeedEntry[]> {
    console.log(`\n\x1b[33m[Creating the Blogroll]\x1b[0m`);

    const urls = (await Deno.readTextFile("contents/blogroll.txt"))
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const entries = await Promise.all(urls.map(blogroll_feed));
    const all_entries = entries.filter((e): e is FeedEntry => e !== null);

    all_entries.sort((a, b) => b.date.getTime() - a.date.getTime());

    return all_entries;
  },
};

async function blogroll_feed(
  url: string,
): Promise<FeedEntry | null> {
  const start = performance.now();
  let feed;
  try {
    console.log(
      `\x1b[90m${NowHHMMSS()}\x1b[0m ` +
        `\x1b[33m├─\x1b[0m Fetching ${url}...\x1b[0m`,
    );
    const response = await fetch(url);
    const xml = await response.text();
    feed = await parseFeed(xml);
  } catch (error) {
    console.error({ url, error });
    return null;
  }

  if (!feed.entries || feed.entries.length === 0) return null;

  const first_entry = feed.entries[0];

  const entry: FeedEntry = {
    author: first_entry.author?.name ?? undefined,
    title: first_entry.title?.value ?? "",
    url: (first_entry.links.find(
      (it: any) => it.type === "text/html" || it.href?.endsWith(".html"),
    ) ?? first_entry.links[0])?.href ?? "",
    date: first_entry.published ?? first_entry.updated ?? new Date(),
  };

  const duration = performance.now() - start;

  console.log(
    `\x1b[90m${NowHHMMSS()}\x1b[0m ` +
      `\x1b[33m├─\x1b[0m "${entry.title}" \x1b[90m (${entry.url}) (${
        duration.toFixed(0)
      } ms)\x1b[0m`,
  );

  return entry;
}
