import { Blog } from "./Blog.ts";
import { initTreeSitter } from "./tree_sitter.ts";

type CliSchema = {
  draft: { args: ["title"]; options: { published?: boolean } };
  build: { args: []; options: { profile?: boolean; blogroll?: boolean; clean?: boolean } };
  watch: { args: []; options: { profile?: boolean; clean?: boolean } };
  serve: { args: []; options: { port?: string } };
  spell: { args: []; options: Record<string, never> };
};

function printHelp(): void {
  console.log(`Available commands:

  draft <title>     Create a new .dj file in the /posts folder
  build             Does a lot of things to publish
  watch             Rebuilds the whole blog on change
  serve             Spawns miniserver to preview the results
  spell             Spell checks the newest post with wiz

Run <command> --help for more information about a command`);
}

function printCommandHelp(cmd: keyof CliSchema): void {
  switch (cmd) {
    case "draft":
      console.log(`Usage: draft <title> [options]

Create a new .dj file in the /posts folder to start writing an article

Arguments:
  title              The title of the post

Options:
  --published        Set published to true (default: false)`);
      break;
    case "build":
      console.log(`Usage: build [options]

Does a lot of things to publish

Options:
  --profile          Enable profiling
  --blogroll         Include blogroll
  --clean            Clean dist folder first (default: true)`);
      break;
    case "watch":
      console.log(`Usage: watch [options]

Rebuilds the whole blog on change

Options:
  --profile          Enable profiling
  --clean            Clean dist folder first`);
      break;
    case "serve":
      console.log(`Usage: serve [options]

Spawns miniserver to preview the results of the build.

Options:
  --port             Port to listen on (default: 8080)`);
      break;
    case "spell":
      console.log(`Usage: spell

Spell checks the newest post with wiz`);
      break;
  }
}

function parseArgs(argv: string[]): { command: keyof CliSchema; args: string[]; options: Record<string, string | boolean> } {
  const rawCommand = argv[0];

  if (!rawCommand || rawCommand === "--help" || rawCommand === "-h") {
    printHelp();
    Deno.exit(0);
  }

  const validCommands = ["draft", "build", "watch", "serve", "spell"] as const;
  if (!validCommands.includes(rawCommand as typeof validCommands[number])) {
    console.error(`Unknown command: ${rawCommand}`);
    console.error(`Run with --help to see available commands`);
    Deno.exit(1);
  }

  const command = rawCommand as keyof CliSchema;

  if (argv.includes("--help") || argv.includes("-h")) {
    printCommandHelp(command);
    Deno.exit(0);
  }

  const options: Record<string, string | boolean> = {};
  const args: string[] = [];

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");
      if (value !== undefined) {
        options[key] = value === "true" || value === "1" ? true : value === "false" || value === "0" ? false : value;
      } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        options[key] = argv[++i];
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        options[key] = argv[++i];
      } else {
        options[key] = true;
      }
    } else {
      args.push(arg);
    }
  }

  return { command, args, options };
}

async function main() {
  const { command, args, options } = parseArgs(Deno.args);

  switch (command) {
    case "draft": {
      const title = args[0];
      if (!title) {
        console.error("Error: Missing required argument: title");
        Deno.exit(1);
      }
      await Blog.draft(title, options.published === true);
      return;
    }

    case "build": {
      await initTreeSitter();
      const profile = options.profile === true;
      const clean = options.clean !== false;
      const blogroll = options.blogroll === true;
      await Blog.build(clean, profile, blogroll);
      return;
    }

    case "watch": {
      await initTreeSitter();
      const profile = options.profile === true;
      const clean = options.clean !== false;
      await Blog.watch(clean, profile);
      return;
    }

    case "serve": {
      await initTreeSitter();
      const port = parseInt(options.port as string ?? "8080");
      await Blog.serve(port);
      return;
    }

    case "spell": {
      await Blog.spell();
      return;
    }
  }
}

if (import.meta.main) await main();
