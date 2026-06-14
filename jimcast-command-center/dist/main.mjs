import { createInterface } from "node:readline";
//#region ../../jimcast-sdk/packages/sdk/dist/index.mjs
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
/**
* Creates a widget — a persistent UI block rendered in the command bar.
*
* @example
* ```typescript
* const branchWidget = createWidget({
*   id: "git-status.branch-widget",
*   defaultSlot: "below-input",
*   async render(context) {
*     return {
*       type: "rows",
*       rows: [
*         { label: "branch", value: context.project.branch ?? "none" },
*         { label: "open PRs", value: String(context.project.openPRs.length) },
*       ],
*     };
*   },
* });
* ```
*/
function createWidget(definition) {
	return {
		...definition,
		_type: "widget"
	};
}
//#endregion
//#region src/index.ts
/**
* Hello Test — a minimal Jimcast plugin.
*
* Demonstrates:
* - definePlugin / createCommand basics
* - Returning CommandItems from execute()
* - Attaching actions to items
* - Using context.showToast
* - Using context.copyToClipboard
* - createWidget for persistent UI slots
*/
const helloCommand = createCommand({
	id: "jimcast-command-center.greet",
	title: "Say Hello",
	subtitle: "Choose a greeting style",
	keywords: [
		"hi",
		"greet",
		"welcome"
	],
	async execute(context) {
		const branch = context.project.branch ?? "unknown";
		return [{
			id: "toast-greeting",
			title: "Show a toast greeting",
			subtitle: "Pops up a brief notification",
			accessory: "toast",
			actions: [{
				id: "show-toast",
				title: "Show Greeting",
				shortcut: "cmd+return",
				async onAction() {
					await context.showToast(`Hello from Jimcast! You're on branch: ${branch}`, { style: "success" });
				}
			}]
		}, {
			id: "copy-greeting",
			title: "Copy greeting to clipboard",
			subtitle: "Copies a hello message you can paste anywhere",
			accessory: "clipboard",
			actions: [{
				id: "copy",
				title: "Copy to Clipboard",
				shortcut: "cmd+c",
				async onAction() {
					await context.copyToClipboard(`Hello from Jimcast! Branch: ${branch}`);
					await context.showToast("Copied!", {
						style: "success",
						duration: 1500
					});
				}
			}]
		}];
	}
});
const projectInfoCommand = createCommand({
	id: "jimcast-command-center.project-info",
	title: "Show Project Info",
	subtitle: "Displays info about the current project",
	keywords: [
		"info",
		"project",
		"repo",
		"branch"
	],
	async execute(context) {
		const { project } = context;
		return [{
			id: "cwd",
			title: project.cwd,
			subtitle: "Working directory",
			accessory: "path",
			preview: {
				type: "markdown",
				content: `## Project Info\n\n- **CWD:** \`${project.cwd}\`\n- **Branch:** \`${project.branch ?? "none"}\`\n- **Remote:** \`${project.remoteName ?? "none"}\`\n- **Open PRs:** ${project.openPRs.length}`
			},
			actions: [{
				id: "copy-path",
				title: "Copy Path",
				async onAction() {
					await context.copyToClipboard(project.cwd);
					await context.showToast("Path copied", { style: "success" });
				}
			}]
		}, ...project.branch ? [{
			id: "branch",
			title: project.branch,
			subtitle: "Current branch",
			accessory: "branch",
			actions: [{
				id: "copy-branch",
				title: "Copy Branch Name",
				async onAction() {
					await context.copyToClipboard(project.branch);
					await context.showToast("Branch name copied", { style: "success" });
				}
			}]
		}] : []];
	}
});
const branchWidget = createWidget({
	id: "jimcast-command-center.branch-widget",
	defaultSlot: "below-input",
	async render(context) {
		const { project } = context;
		return {
			type: "rows",
			rows: [{
				label: "branch",
				value: project.branch ?? "none",
				valueColor: project.branch ? "green" : "default"
			}, {
				label: "cwd",
				value: project.cwd
			}]
		};
	}
});
//#endregion
//#region src/main.ts
bootstrapPlugin(definePlugin({
	name: "Hello Test",
	description: "A minimal example plugin showing the Jimcast SDK basics",
	commands: [helloCommand, projectInfoCommand],
	widgets: [branchWidget]
}));
//#endregion
export {};
