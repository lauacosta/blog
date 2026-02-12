export function dirname(path: string): string {
	return path.substring(0, path.lastIndexOf("/"));
}

export async function write_file(
	path: string,
	content: Uint8Array | string,
): Promise<void> {
	const start = performance.now();

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

	const time = Temporal.Now.plainTimeISO()
		.toLocaleString("en-gb", { hour12: false });
	const ms = (performance.now() - start).toFixed(2);

	console.log(
		`\x1b[90m${time} \x1b[34m├─ \x1b[90m${path} (${ms} ms)`,
	);
}

export async function copy_path(path: string): Promise<void> {
	if (path.endsWith("*")) {
		const dir = path.replace("*", "");
		const futs = [];
		for await (const entry of Deno.readDir(`contents/${dir}`)) {
			if (entry.isFile) {
				futs.push(copy_path(`${dir}/${entry.name}`));
			}
		}
		await Promise.all(futs);
	} else {
		await write_file(
			`dist/${path}`,
			await Deno.readFile(`contents/${path}`),
		);
	}
}

export async function* walk_dir(
	dir: string,
): AsyncIterableIterator<string> {
	for await (const entry of Deno.readDir(dir)) {
		const path = `${dir}${entry.name}`;
		if (entry.isDirectory) {
			yield* walk_dir(path);
		} else {
			yield path;
		}
	}
}
