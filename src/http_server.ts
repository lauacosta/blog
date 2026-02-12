import { serveDir } from "@std/http/file-server";

export function NowHHMMSS() {
  return new Date().toTimeString().slice(0, 8);
}

export async function ServeBlog(port: number, hostname: string) {
  await Deno.serve({ port, hostname }, async (req) => {
    const start = performance.now();

    const res = await serveDir(req, {
      fsRoot: "dist",
      urlRoot: "",
      quiet: true,
    });

    const duration = (performance.now() - start).toFixed(2);
    const url = new URL(req.url);

    console.log(
      `\x1b[90m${NowHHMMSS()}\x1b[0m ` +
        `\x1b[32m├─\x1b[0m ` +
        `${req.method} ${url.pathname} ` +
        `\x1b[90m(${duration} ms)\x1b[0m`,
    );

    return res;
  }).finished;
}
