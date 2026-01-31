// deno-lint-ignore-file no-explicit-any
type ArgKind = "number" | "string" | "boolean";

type ArgDef<T> = {
  kind: ArgKind;
  default?: T;
};

export function string(opts?: { default?: string }): ArgDef<string> {
  return { kind: "string", default: opts?.default };
}

export function number(opts?: { default?: number }): ArgDef<number> {
  return { kind: "number", default: opts?.default };
}

export function boolean(opts?: { default?: boolean }): ArgDef<boolean> {
  return { kind: "boolean", default: opts?.default };
}

type Command<A extends Record<string, ArgDef<any>>, O extends Record<string, ArgDef<any>>> = {
  name: string;
  description?: string;
  args?: A;
  options?: O;
};

export function defineCommand<
  A extends Record<string, ArgDef<any>>,
  O extends Record<string, ArgDef<any>>,
>(cmd: Command<A, O>): Command<A, O> {
  return cmd;
}

type ValueOf<T> = T extends ArgDef<infer V> ? V : never;

type ParsedArgs<A> = {
  [K in keyof A]: ValueOf<A[K]>;
};

type ParsedOptions<O> = {
  [K in keyof O]: O[K] extends { default: infer D } ? ValueOf<O[K]> : ValueOf<O[K]> | undefined;
};

function coerce(value: string, kind: ArgKind): any {
  switch (kind) {
    case "number": {
      const num = Number(value);
      if (isNaN(num)) throw new Error(`Cannot parse "${value}" as number`);
      return num;
    }
    case "boolean":
      return value === "true" || value === "1";
    case "string":
      return value;
  }
}

function printHelp<A extends Record<string, ArgDef<any>>, O extends Record<string, ArgDef<any>>>(
  cmd: Command<A, O>,
) {
  console.log(
    `Usage: ${cmd.name} [options] ${
      cmd.args
        ? Object.keys(cmd.args).map((k) => {
          const arg = cmd.args![k];
          const hasDefault = arg.default !== undefined;
          return hasDefault ? `[${k}]` : `<${k}>`;
        }).join(" ")
        : ""
    }`,
  );
  if (cmd.description) {
    console.log(`\n${cmd.description}`);
  }

  if (cmd.args && Object.keys(cmd.args).length > 0) {
    console.log("\nArguments:");
    for (const key in cmd.args) {
      const arg = cmd.args[key];
      const defaultStr = arg.default !== undefined ? ` (default: ${arg.default})` : "";
      console.log(`  ${key}\t\t${arg.kind}${defaultStr}`);
    }
  }

  if (cmd.options && Object.keys(cmd.options).length > 0) {
    console.log("\nOptions:");
    for (const key in cmd.options) {
      const opt = cmd.options[key];
      const defaultStr = opt.default !== undefined ? ` (default: ${opt.default})` : "";
      console.log(`  --${key}\t\t${opt.kind}${defaultStr}`);
    }
  }
}
function parse<
  A extends Record<string, ArgDef<any>>,
  O extends Record<string, ArgDef<any>>,
>(
  cmd: Command<A, O>,
  argv: string[],
): {
  args: ParsedArgs<A>;
  options: ParsedOptions<O>;
} {
  const opts: Record<string, any> = {};
  const positionals: any[] = [];

  if (cmd.options) {
    for (const key in cmd.options) {
      const opt = cmd.options[key];
      if (opt.default !== undefined) {
        opts[key] = opt.default;
      }
    }
  }

  const optionDefs = (cmd.options || {}) as Record<string, ArgDef<any>>;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      printHelp(cmd);
      Deno.exit(0);
    }

    if (arg.startsWith("--")) {
      const [fullKey, inlineValue] = arg.slice(2).split("=");
      const def = optionDefs[fullKey];

      if (!def) throw new Error(`Unknown option ${fullKey}`);

      if (def.kind === "boolean") {
        if (inlineValue !== undefined) {
          opts[fullKey] = inlineValue === "true" || inlineValue === "1";
        } else {
          opts[fullKey] = true;
        }
      } else {
        const value = inlineValue ?? argv[++i];
        if (value === undefined) throw new Error(`Option --${fullKey} requires a value`);
        opts[fullKey] = coerce(value, def.kind);
      }

      continue;
    }

    if (arg.startsWith("-")) {
      const key = arg.slice(1);
      const def = optionDefs[key];

      if (!def) throw new Error(`Unknown option ${key}`);

      if (def.kind === "boolean") {
        opts[key] = true;
      } else {
        const value = argv[++i];
        if (value === undefined) throw new Error(`Option -${key} requires a value`);
        opts[key] = coerce(value, def.kind);
      }
      continue;
    }
    positionals.push(arg);
  }

  const parsedArgs: Record<string, any> = {};
  if (cmd.args) {
    let i = 0;
    for (const key in cmd.args) {
      const def = cmd.args[key];

      if (i < positionals.length) {
        parsedArgs[key] = coerce(positionals[i], def.kind);
        i++;
      } else if (def.default !== undefined) {
        parsedArgs[key] = def.default;
      } else {
        throw new Error(`Missing required argument: ${key}`);
      }
    }
  }

  return {
    args: parsedArgs as ParsedArgs<A>,
    options: opts as ParsedOptions<O>,
  };
}

type Cli<Commands extends Record<string, Command<any, any>>> = {
  commands: Commands;
  description?: string;
};

function printCliHelp<Commands extends Record<string, Command<any, any>>>(
  cli: Cli<Commands>,
): void {
  console.log("Available commands:\n");
  for (const name in cli.commands) {
    const cmd = cli.commands[name];
    console.log(`  ${name}\t\t${cmd.description || ""}`);
  }
  console.log("\nRun <command> --help for more information about a command");
}

export function defineCli<Commands extends Record<string, Command<any, any>>>(
  cli: Cli<Commands>,
) {
  return cli;
}

type ExtractCommand<T> = T extends Command<infer A, infer O> ? {
    args: ParsedArgs<A>;
    options: ParsedOptions<O>;
  }
  : never;

type ParseResult<Commands extends Record<string, Command<any, any>>> = {
  [K in keyof Commands]: {
    command: K;
  } & ExtractCommand<Commands[K]>;
}[keyof Commands];

export function parseCli<Commands extends Record<string, Command<any, any>>>(
  cli: Cli<Commands>,
  argv: string[] = Deno.args,
): ParseResult<Commands> {
  const commandName = argv[0];

  if (!commandName || commandName === "--help" || commandName === "-h") {
    printCliHelp(cli);
    Deno.exit(0);
  }

  const cmd = cli.commands[commandName];

  if (!cmd) {
    console.error(`Unknown command: ${commandName}`);
    console.error(`Run with --help to see available commands`);
    Deno.exit(1);
  }

  const parsed = parse(cmd, argv.slice(1));

  return {
    command: commandName,
    ...parsed,
  } as ParseResult<Commands>;
}

type ExtractCommandName<T> = T extends { command: infer C } ? C extends string | number ? C
  : string
  : string;

export type AssertAllCommandsHandled<T> = T extends never ? never
  : { error: `ERROR: Unhandled command "${ExtractCommandName<T>}". Add a case for this command.` };
