import { Blog, cli_schema } from "./Blog.ts";
import { assertAllHandled, parseCli } from "./cli.ts";
import { initTreeSitter } from "./tree_sitter.ts";

async function main() {
  const cli = parseCli(cli_schema);

  if (cli.command === "draft") {
    await Blog.draft(cli.args.title, cli.options.published ?? true);
    return;
  }

  if (cli.command === "build") {
    await initTreeSitter();
    const profile = cli.options.profile ?? false;
    const clean = cli.options.clean ?? true;
    const blogroll = cli.options.blogroll ?? false;
    await Blog.build(clean, profile, blogroll);
    return;
  }

  if (cli.command === "watch") {
    await initTreeSitter();
    const profile = cli.options.profile ?? false;
    const clean = cli.options.clean ?? true;
    await Blog.watch(clean, profile);
    return;
  }

  if (cli.command === "serve") {
    await initTreeSitter();
    const port = cli.options.port ? parseInt(cli.options.port) : 8080;
    await Blog.serve(port);
    return;
  }

  if (cli.command === "spell") {
    await Blog.spell();
    return;
  }

  assertAllHandled(cli);
}

if (import.meta.main) await main();
