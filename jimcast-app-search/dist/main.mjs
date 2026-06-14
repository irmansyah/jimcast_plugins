import { createInterface } from "node:readline";
//#region node_modules/.pnpm/@jimcast+sdk@file+..+..+jimcast-sdk+packages+sdk/node_modules/@jimcast/sdk/dist/index.mjs
/**
* Creates a command.
*
* This is the primary building block of a Jimcast plugin. Every user-visible
* action is a command.
*
* @example
* ```typescript
* const greetCommand = createCommand({
*   id: "my-plugin.greet",
*   title: "Say Hello",
*   subtitle: "Shows a greeting toast",
*   async execute(context) {
*     await context.showToast("Hello!");
*   },
* });
* ```
*/
function createCommand(definition) {
	return {
		...definition,
		_type: "command"
	};
}
/**
* Defines a plugin and registers it with the Jimcast runtime.
*
* Every plugin must call this exactly once, as its default export.
*
* @example
* ```typescript
* export default definePlugin({
*   name: "My Plugin",
*   description: "Does useful things",
*   commands: [greetCommand, openPRCommand],
* });
* ```
*/
function definePlugin(definition) {
	return {
		...definition,
		_type: "plugin"
	};
}
/**
* Returns `true` if the {@link ExecResult} represents a successful execution
* (exit code 0, not timed out).
*
* @example
* ```typescript
* const result = await context.exec("git status");
* if (!execSucceeded(result)) {
*   await context.showToast("git status failed", { style: "failure", message: result.stderr.trim() });
*   return;
* }
* ```
*/
function execSucceeded(result) {
	return result.exitCode === 0 && !result.timedOut;
}
/**
* @internal
* Creates a PluginStorage implementation backed by the RPC transport.
* This is called by the runtime when setting up the execution context —
* plugin authors never construct this directly.
*/
function createStorage(send) {
	return {
		async get(key) {
			return (await send("storage.get", { key })).value;
		},
		async set(key, value) {
			await send("storage.set", {
				key,
				value
			});
		},
		async delete(key) {
			await send("storage.delete", { key });
		},
		async has(key) {
			return (await send("storage.has", { key })).exists;
		},
		async keys(options) {
			return (await send("storage.keys", { prefix: options?.prefix ?? null })).keys;
		},
		async clear() {
			await send("storage.clear", {});
		}
	};
}
/**
* @internal
* Plugin ↔ Core IPC transport.
*
* Protocol: newline-delimited JSON over stdin/stdout
* Request (core → plugin):  {"id": "uuid", "command": "...", "args": {...}}
* Response (plugin → core): {"id": "uuid", "result": {...}}
*                        or {"id": "uuid", "error": "message"}
*/
var RpcTransport = class {
	stdin;
	stdout;
	onRequest;
	pending = /* @__PURE__ */ new Map();
	constructor(stdin, stdout, onRequest) {
		this.stdin = stdin;
		this.stdout = stdout;
		this.onRequest = onRequest;
		this.listen();
	}
	/** Send a request to core and await the response. */
	send(command, args) {
		return new Promise((resolve, reject) => {
			const id = crypto.randomUUID();
			this.pending.set(id, [resolve, reject]);
			this.write({
				id,
				command,
				args
			});
		});
	}
	respond(id, result) {
		this.write({
			id,
			result
		});
	}
	respondError(id, message) {
		this.write({
			id,
			error: message
		});
	}
	write(message) {
		this.stdout.write(JSON.stringify(message) + "\n");
	}
	listen() {
		createInterface({
			input: this.stdin,
			crlfDelay: Infinity
		}).on("line", (line) => {
			if (!line.trim()) return;
			let message;
			try {
				message = JSON.parse(line);
			} catch {
				return;
			}
			if ("command" in message) {
				const req = message;
				this.onRequest(req.command, req.args, req.id).then((result) => this.respond(req.id, result), (err) => {
					const msg = err instanceof Error ? err.message : String(err);
					this.respondError(req.id, msg);
				});
			} else {
				const res = message;
				const pending = this.pending.get(res.id);
				if (!pending) return;
				this.pending.delete(res.id);
				const [resolve, reject] = pending;
				if (res.error) reject(new Error(res.error));
				else resolve(res.result);
			}
		});
	}
};
async function bootstrapPlugin(plugin) {
	let transport;
	const handler = async (command, args, id) => {
		return handleCoreRequest(command, args, plugin, transport);
	};
	transport = new RpcTransport(process.stdin, process.stdout, handler);
}
async function handleCoreRequest(command, args, plugin, transport) {
	if (command === "executeCommand") {
		const { commandId, projectContext, envContext } = args;
		const cmd = findCommand(plugin, commandId);
		if (!cmd) throw new Error(`Unknown command: ${commandId}`);
		const context = buildContext(projectContext, envContext, transport);
		return { items: await cmd.execute(context) ?? [] };
	}
	if (command === "renderWidget") {
		const { widgetId, projectContext, envContext } = args;
		const widget = plugin.widgets?.find((w) => w.id === widgetId);
		if (!widget) throw new Error(`Unknown widget: ${widgetId}`);
		const context = buildContext(projectContext, envContext, transport);
		return { content: await widget.render(context) };
	}
	throw new Error(`Unknown command: ${command}`);
}
function findCommand(plugin, commandId) {
	for (const entry of plugin.commands) {
		if (entry._type === "command" && entry.id === commandId) return entry;
		if (entry._type === "command-group") {
			for (const cmd of entry.commands) if (cmd.id === commandId) return cmd;
		}
	}
	return null;
}
function buildContext(project, env, transport) {
	const send = (command, args) => transport.send(command, args);
	return {
		project,
		env,
		storage: createStorage(send),
		async exec(command, options = {}) {
			return send("exec", {
				command,
				options
			});
		},
		async execStreamed(command, options) {
			const { onLine, onStderrLine, ...rest } = options;
			const result = await send("execStreamed", {
				command,
				options: rest
			});
			for (const line of result.stdout.split("\n")) if (line) onLine(line);
			if (onStderrLine) {
				for (const line of result.stderr.split("\n")) if (line) onStderrLine(line);
			}
			return result;
		},
		async showToast(title, options = {}) {
			await send("ui.showToast", {
				title,
				options
			});
		},
		appendOutput(line) {
			send("ui.appendOutput", { line });
		},
		async copyToClipboard(text) {
			await send("ui.copyToClipboard", { text });
		},
		async openUrl(url) {
			await send("ui.openUrl", { url });
		}
	};
}
//#endregion
//#region src/index.ts
/**
* jimcast-plugin-apps
*
* Searches macOS .app bundles and CLI tools from common bin directories.
* Command-only plugin — shows results in the search list, no persistent widget.
*
* App behavior:
* - .app bundles → `open -a "App Name"` (launches or focuses if already running)
* - CLI binaries → opens in a new terminal via `open -a Terminal`
*/
const APP_DIRS = [
	"/Applications",
	"/System/Applications",
	"/Users/mane/.nix-profile/bin"
];
const BIN_DIRS = [
	`/Users/${getUsername()}/.nix-profile/bin`,
	"/run/current-system/sw/bin",
	"/opt/homebrew/bin",
	"/usr/local/bin",
	"/usr/bin"
];
function getUsername() {
	return (process.env["HOME"] ?? "").split("/").pop() ?? "user";
}
async function scanApps(context) {
	const entries = [];
	for (const dir of APP_DIRS) {
		const check = await context.exec(`test -d ${JSON.stringify(dir)} && echo yes`);
		if (!execSucceeded(check) || !check.stdout.includes("yes")) continue;
		const result = await context.exec(`ls ${JSON.stringify(dir)} 2>/dev/null | grep '\\.app$'`);
		if (!execSucceeded(result)) continue;
		for (const line of result.stdout.trim().split("\n").filter(Boolean)) {
			const name = line.replace(/\.app$/, "").trim();
			if (name) entries.push({
				name,
				path: `${dir}/${line}`,
				type: "app"
			});
		}
	}
	return entries;
}
async function scanBins(context) {
	const entries = [];
	for (const dir of BIN_DIRS) {
		const check = await context.exec(`test -d ${JSON.stringify(dir)} && echo yes`);
		if (!execSucceeded(check) || !check.stdout.includes("yes")) continue;
		const result = await context.exec(`find ${JSON.stringify(dir)} -maxdepth 1 -type f -perm +111 -exec basename {} \\; 2>/dev/null`);
		if (!execSucceeded(result)) continue;
		for (const line of result.stdout.trim().split("\n").filter(Boolean)) {
			const name = line.trim();
			if (name) entries.push({
				name,
				path: `${dir}/${name}`,
				type: "cli"
			});
		}
	}
	return entries;
}
function fuzzyMatch(query, name) {
	if (!query) return true;
	const q = query.toLowerCase();
	const n = name.toLowerCase();
	let qi = 0;
	for (let i = 0; i < n.length && qi < q.length; i++) if (n[i] === q[qi]) qi++;
	return qi === q.length;
}
function scoreMatch(query, name) {
	const q = query.toLowerCase();
	const n = name.toLowerCase();
	if (n === q) return 100;
	if (n.startsWith(q)) return 90;
	if (n.includes(q)) return 70;
	return 50;
}
function appToItem(app, context) {
	if (app.type === "app") return {
		id: `app-${app.name}`,
		title: app.name,
		subtitle: app.path,
		accessory: "app",
		keywords: [app.name.toLowerCase()],
		actions: [{
			id: "launch",
			title: "Launch / Focus",
			shortcut: "cmd+return",
			async onAction() {
				const r = await context.exec(`open -a ${JSON.stringify(app.name)}`);
				if (!execSucceeded(r)) await context.showToast(`Failed to open ${app.name}`, {
					style: "failure",
					message: r.stderr.trim()
				});
			}
		}, {
			id: "copy-path",
			title: "Copy Path",
			shortcut: "cmd+c",
			async onAction() {
				await context.copyToClipboard(app.path);
				await context.showToast("Path copied", {
					style: "success",
					duration: 1500
				});
			}
		}]
	};
	return {
		id: `cli-${app.name}`,
		title: app.name,
		subtitle: app.path,
		accessory: "cli",
		keywords: [
			app.name.toLowerCase(),
			"terminal",
			"cli",
			"bin"
		],
		actions: [{
			id: "open-in-terminal",
			title: "Open in Terminal",
			shortcut: "cmd+return",
			async onAction() {
				const script = `osascript -e 'tell application "Terminal" to do script "${app.name}"'`;
				const r = await context.exec(script);
				if (!execSucceeded(r)) await context.showToast(`Failed to open ${app.name}`, {
					style: "failure",
					message: r.stderr.trim()
				});
			}
		}, {
			id: "copy-path",
			title: "Copy Path",
			shortcut: "cmd+c",
			async onAction() {
				await context.copyToClipboard(app.path);
				await context.showToast("Path copied", {
					style: "success",
					duration: 1500
				});
			}
		}]
	};
}
let cachedEntries = null;
async function getAllEntries(context) {
	if (cachedEntries) return cachedEntries;
	const [apps, bins] = await Promise.all([scanApps(context), scanBins(context)]);
	const seen = /* @__PURE__ */ new Set();
	const all = [];
	for (const entry of [...apps, ...bins]) if (!seen.has(entry.name.toLowerCase())) {
		seen.add(entry.name.toLowerCase());
		all.push(entry);
	}
	cachedEntries = all;
	return all;
}
//#endregion
//#region src/main.ts
bootstrapPlugin(definePlugin({
	name: "App Search",
	description: "Search and launch macOS apps and CLI tools",
	commands: [createCommand({
		id: "apps.search",
		title: "Search Apps & Tools",
		subtitle: "Launch apps or open CLI tools in Terminal",
		keywords: [
			"app",
			"launch",
			"open",
			"run",
			"tool",
			"bin",
			"cli",
			"finder"
		],
		async execute(context) {
			return [...await getAllEntries(context)].sort((a, b) => {
				if (a.type !== b.type) return a.type === "app" ? -1 : 1;
				return a.name.localeCompare(b.name);
			}).map((entry) => appToItem(entry, context));
		}
	}), createCommand({
		id: "apps.search-query",
		title: "Open App or Tool",
		subtitle: "Type a name to find and launch",
		keywords: [
			"app",
			"open",
			"launch",
			"find",
			"search"
		],
		async execute(context) {
			const query = await context.storage.get("last-query") ?? "";
			const all = await getAllEntries(context);
			const filtered = query ? all.filter((e) => fuzzyMatch(query, e.name)).sort((a, b) => scoreMatch(query, b.name) - scoreMatch(query, a.name)) : all.sort((a, b) => {
				if (a.type !== b.type) return a.type === "app" ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
			if (filtered.length === 0) {
				await context.showToast(`No apps found for "${query}"`, { duration: 2e3 });
				return [];
			}
			return filtered.map((entry) => appToItem(entry, context));
		}
	})]
}));
//#endregion
export {};
