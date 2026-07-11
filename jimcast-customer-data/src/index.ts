// [plugin] jimcast-customer-data/src/index.ts

import {
  createCommand,
  createCommandGroup,
  createWidget,
  definePlugin,
  execFailed,
  type CommandItem,
  type ExecutionContext,
  type WidgetContent,
} from "@jimcast/sdk";

// NOTE: React is intentionally not used anywhere in this file anymore.
// ExecutionContext (context.ts) exposes no `react` field, and the previous
// `{ type: 'component', render: () => ReactNode }` widget content never
// worked in the first place: rpc.ts ships widget content to core as
// newline-delimited JSON over stdin/stdout, and a `render` function does
// not survive JSON.stringify — core would receive `{ type: 'component' }`
// with nothing to call. Every widget below is built from the two things
// that actually cross that boundary: plain WidgetItem data, and
// WidgetActionFn (which rpc.ts keeps in-process via widgetActionRegistry
// and only ships an `{ _fnId }` reference for).

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id:    number;
  name:  string;
  email: string;
  /** jsonplaceholder's /users endpoint never actually returns this. */
  role?: string;
}

interface Task {
  id:   string;
  text: string;
  done: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUserArray(data: unknown): data is User[] {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as User).id === "number" &&
        typeof (item as User).name === "string" &&
        typeof (item as User).email === "string"
    )
  );
}

async function fetchUsers(): Promise<User[] | null> {
  try {
    const data: unknown = await fetch(
      "https://jsonplaceholder.typicode.com/users"
    ).then((r) => r.json());
    return isUserArray(data) ? data : null;
  } catch {
    return null;
  }
}

async function loadTasks(context: ExecutionContext): Promise<Task[]> {
  const raw = await context.storage.get("tasks");
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Task[]) : [];
  } catch {
    return [];
  }
}

async function saveTasks(context: ExecutionContext, tasks: Task[]): Promise<void> {
  await context.storage.set("tasks", JSON.stringify(tasks));
}

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/**
 * REST client. There's no text-input primitive on WidgetItem/WidgetAttribute
 * (labels/colors/image only), so live user input has to come through
 * `renderQuery`'s `query` string (fed from the search box) rather than
 * component-local state. Query syntax: `<url>` (defaults to GET) or
 * `<METHOD> <url>`.
 */
const restApiWidget = createWidget({
  id: "jimcast-rest-api.widget.rest-api",
  showIn: ["default"],

  async renderQuery(context: ExecutionContext, query: string): Promise<WidgetContent | null> {
    const { green, fg4 } = context.host.theme.colors;
    const trimmed = query.trim();

    if (!trimmed) {
      return { type: "text", data: "Type a URL to GET, or `METHOD url` (e.g. POST https://…)" };
    }

    const [maybeMethod = "", ...rest] = trimmed.split(/\s+/);
    const isMethod = (HTTP_METHODS as readonly string[]).includes(maybeMethod.toUpperCase());
    const method   = isMethod ? (maybeMethod.toUpperCase() as typeof HTTP_METHODS[number]) : "GET";
    const url      = isMethod ? rest.join(" ") : trimmed;

    if (!url) return { type: "text", data: "Missing URL." };

    return {
      type: "rows",
      datas: [
        {
          id: "send",
          attribute: { label1: `${method} ${url}`, color1: green, labelRight: "send", colorRight: fg4 },
          // WidgetActionFn — runs in-process via context.exec, not the
          // undefined bare `shell()` global the old version called.
          action: async (ctx: ExecutionContext) => {
            const escapedUrl = url.replace(/'/g, "'\\''");
            const result = await ctx.exec(
              `curl -s -o /tmp/jimcast_rest_body -w '%{http_code}' -X ${method} '${escapedUrl}'`,
              { timeoutMs: 15_000, ignoreExitCode: true },
            );
            const status = parseInt(result.stdout.trim(), 10) || null;
            if (execFailed(result) && !status) {
              await ctx.showToast("Request failed", { style: "failure", message: "Check the URL and your network connection" });
              return;
            }
            await ctx.showToast(
              `Response: ${status ?? "?"}`,
              { style: status && status < 400 ? "success" : "failure" },
            );
          },
        },
      ],
    };
  },
});

/** Lists the current working directory. Rows are file/dir names; selecting
 * one copies its path to the clipboard (there's no navigation/drill-down
 * primitive here beyond the widget's own expandable mechanism). */
const fileExplorerWidget = createWidget({
  id: "jimcast-rest-api.widget.file-explorer",
  showIn: ["default"],

  async render(context: ExecutionContext): Promise<WidgetContent> {
    const { fg, fg4 } = context.host.theme.colors;

    const result = await context.exec("ls -1ap", { timeoutMs: 5_000, ignoreExitCode: true });
    if (execFailed(result)) {
      return { type: "error", message: "Failed to list directory." };
    }

    const entries = result.stdout.split("\n").filter((line) => line && line !== "./");
    if (entries.length === 0) {
      return { type: "text", data: "Empty directory." };
    }

    return {
      type: "rows",
      datas: entries.map((entry, i) => ({
        id: String(i),
        attribute: {
          label1: entry,
          color1: fg,
          labelRight: entry.endsWith("/") ? "dir" : "file",
          colorRight: fg4,
        },
        action: async (ctx: ExecutionContext) => {
          await ctx.copyToClipboard(entry);
          await ctx.showToast(`Copied: ${entry}`);
        },
      })),
    };
  },
});

/**
 * Simple task list backed by plugin storage. Typing non-empty query text
 * offers to add it as a task; an empty query lists existing tasks, and
 * selecting one toggles done/open.
 */
const taskManagementWidget = createWidget({
  id: "jimcast-rest-api.widget.task-management",
  showIn: ["default"],

  async renderQuery(context: ExecutionContext, query: string): Promise<WidgetContent> {
    const { green, fg, fg4 } = context.host.theme.colors;
    const trimmed = query.trim();

    if (trimmed) {
      return {
        type: "rows",
        datas: [
          {
            id: "add-new",
            attribute: { label1: `Add: "${trimmed}"`, color1: green },
            action: async (ctx: ExecutionContext) => {
              const tasks = await loadTasks(ctx);
              tasks.push({ id: crypto.randomUUID(), text: trimmed, done: false });
              await saveTasks(ctx, tasks);
              await ctx.showToast("Task added");
            },
          },
        ],
      };
    }

    const tasks = await loadTasks(context);
    if (tasks.length === 0) {
      return { type: "text", data: "No tasks yet — type to add one." };
    }

    return {
      type: "rows",
      datas: tasks.map((task) => ({
        id: task.id,
        attribute: {
          label1: task.text,
          color1: task.done ? fg4 : fg,
          labelRight: task.done ? "done" : "open",
          colorRight: fg4,
        },
        action: async (ctx: ExecutionContext) => {
          const current = await loadTasks(ctx);
          const updated = current.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t));
          await saveTasks(ctx, updated);
          await ctx.showToast(task.done ? "Marked open" : "Marked done");
        },
      })),
    };
  },
});

interface QuickTool {
  readonly id:       string;
  readonly label:    string;
  readonly widgetId: string;
}

/** Declares one quick-tool tile: its grid label, and which registered
 * widget it expands to. `widgetId` must belong to this same plugin (see
 * the note on QUICK_TOOLS below). */
function quickTool(id: string, label: string, widgetId: string): QuickTool {
  return { id, label, widgetId };
}

/**
 * Quick-tools launcher. Every child is `kind: 'widget'` pointing at a
 * widget id registered in this same plugin's `widgets` array below —
 * rpc.ts's resolveExpandableChild only ever looks widgets up inside
 * `plugin.widgets`, so a widgetId belonging to another plugin can never
 * resolve and would throw at runtime. The original "Obsidian" entry
 * (`jimcast-internal.obsidian-notes`) is exactly that case, so it's left
 * out here rather than shipping a guaranteed runtime error — swap it back
 * in once there's a local widget (or a supported cross-plugin reference
 * mechanism) to point it at.
 */
const QUICK_TOOLS: readonly QuickTool[] = [
  quickTool("File-Explorer",   "File Explorer",   fileExplorerWidget.id),
  quickTool("Rest-API",        "Rest-API",         restApiWidget.id),
  quickTool("Task-Management", "Task-Management",  taskManagementWidget.id),
];

// Shared between the descriptor's own `expandable.childs` (read directly by
// rpc.ts's resolveExpandableChild — no re-render involved) and the
// `expandable` array userListWidget's render() must attach to its returned
// content on every call. Hoisted once so the two can't drift apart, same
// pattern as core's quickToolsExpandableChilds in widgetRegistry.ts.
const quickToolsExpandableChilds = QUICK_TOOLS.map((tool) => ({
  id:       tool.id,
  kind:     "widget" as const,
  widgetId: tool.widgetId,
}));

const userListWidget = createWidget<true>({
  id: "jimcast-rest-api.widget.user-list",
  showIn: ["default"],
  expandable: true,

  async render(context: ExecutionContext): Promise<WidgetContent<true>> {
    const { green } = context.host.theme.colors;

    return {
      type: "grid-3",
      datas: QUICK_TOOLS.map((tool) => ({
        id: tool.id,
        attribute: { label1: tool.label, color1: green },
        action: { cmd: "true", then: "expand" as const },
      })),
      expandable: quickToolsExpandableChilds,
    };
  },
});

const userEmailBadgeWidget = createWidget({
  id: "jimcast-rest-api.widget.user-email-list",
  // repeat: {
  //   enable:  true,
  //   seconds: 1,
  // },
  async render(context: ExecutionContext): Promise<WidgetContent> {
    const { brightPurple, fg, fg4 } = context.host.theme.colors;

    const users = await fetchUsers();
    if (!users) return { type: "error", message: "Failed to load users." };

    return {
      type:  "rows",
      datas: users.map((user) => ({
        id: String(user.id),
        attribute: {
          label1: user.name, color1: fg,
          label2: user.email, color2: brightPurple,
          labelRight: user.role ?? "member", colorRight: fg4,
        },
        action: async (ctx: ExecutionContext) => {
          await ctx.showToast(`Switched to ${user.email}`);
        },
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const listUsersCommand = createCommand({
  id:       "jimcast-rest-api.command.user-list",
  title:    "List Users",
  subtitle: "Browse all users",
  keywords: ["users", "people", "accounts"],

  async execute(context: ExecutionContext): Promise<CommandItem[]> {
    const users = await fetchUsers();
    if (!users) {
      await context.showToast("Failed to load users.");
      return [];
    }

    return users.map((user) => ({
      id:        String(user.id),
      title:     user.name,
      subtitle:  user.email,
      accessory: user.role ?? "member",
      keywords:  [user.email],
      preview: {
        type:    "markdown",
        content: `## ${user.name}\n\n- **Email:** ${user.email}\n- **Role:** ${user.role ?? "member"}`,
      },
      actions: [
        {
          id:       `copy-email-${user.id}`,
          title:    "Copy Email",
          shortcut: "cmd+shift+c",
          async onAction() {
            await context.copyToClipboard(user.email);
            await context.showToast(`Copied: ${user.email}`);
          },
        },
        {
          id:       `view-user-${user.id}`,
          title:    "View Profile",
          shortcut: "cmd+return",
          async onAction() {
            await context.showToast(`Viewing: ${user.name}`);
          },
        },
      ],
    }));
  },
});

// ---------------------------------------------------------------------------
// Command groups
// ---------------------------------------------------------------------------

const userGroup = createCommandGroup({
  title:    "Users",
  commands: [listUsersCommand],
});

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default definePlugin({
  name:        "Customer Data List",
  description: "Customer Data List",
  commands:    [userGroup],
  widgets:     [
    userEmailBadgeWidget,
    userListWidget,
    restApiWidget,
    fileExplorerWidget,
    taskManagementWidget,
  ],
});

import {
  createCommand,
  createCommandGroup,
  createWidget,
  definePlugin,
  type CommandItem,
  type ExecutionContext,
  type WidgetContent,
} from "@jimcast/sdk";

import React, { useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id:    number;
  name:  string;
  email: string;
  /** jsonplaceholder's /users endpoint never actually returns this. */
  role?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUserArray(data: unknown): data is User[] {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as User).id === "number" &&
        typeof (item as User).name === "string" &&
        typeof (item as User).email === "string"
    )
  );
}

async function fetchUsers(): Promise<User[] | null> {
  try {
    const data: unknown = await fetch(
      "https://jsonplaceholder.typicode.com/users"
    ).then((r) => r.json());
    return isUserArray(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Storage only holds strings (see PluginStorage), so cached users have to be
 * JSON-encoded/decoded on the way in/out. Falls back to a live fetch if
 * there's nothing cached yet, or if what's cached turns out to be garbage —
 * and seeds the cache after a successful fetch so subsequent reads (e.g. the
 * 1s-repeat widget below) don't hit the network every tick.
 */
// async function loadUsers(context: ExecutionContext): Promise<User[] | null> {
//   const cached = await context.storage.get("users");
//   if (cached) {
//     try {
//       const parsed: unknown = JSON.parse(cached);
//       if (isUserArray(parsed)) return parsed;
//     } catch {
//       // fall through to a fresh fetch
//     }
//   }
//
//   const users = await fetchUsers();
//   if (users) {
//     await context.storage.set("users", JSON.stringify(users));
//   }
//   return users;
// }

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

export function RestApiExpandable() {
  const [method, setMethod]     = useState<typeof HTTP_METHODS[number]>('GET')
  const [url, setUrl]           = useState('')
  const [body, setBody]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [response, setResponse] = useState<{ status: number | null; body: string } | null>(null)
  const [error, setError]       = useState<string | null>(null)

  const send = useCallback(async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setResponse(null)

    const escapedUrl  = url.trim().replace(/'/g, "'\\''")
    const escapedBody = body.replace(/'/g, "'\\''")
    const bodyFlag    = (method !== 'GET' && body.trim()) ? `-d '${escapedBody}'` : ''

    try {
      const { stdout, exitCode } = await shell(
        `curl -s -o /tmp/jimcast_rest_body -w '%{http_code}' -X ${method} '${escapedUrl}' ${bodyFlag}`,
        { ignore_exit_code: true, timeout_secs: 15 }
      )
      const status = parseInt(stdout.trim(), 10) || null
      const { stdout: respBody } = await shell('cat /tmp/jimcast_rest_body', { ignore_exit_code: true })
      if (exitCode !== 0 && !status) {
        setError('Request failed — check the URL and your network connection')
      } else {
        setResponse({ status, body: respBody })
      }
    } catch {
      setError('Request failed')
    } finally {
      setLoading(false)
    }
  }, [method, url, body])

  return (
    <div/>
  )
}

const QUICK_TOOLS = [
  { 
    id: 'File-Explorer',
    label: 'File Explorer',
    data: {
      id: 'File-Explorer',
      kind: 'custom',
      render: () => ({ type: 'component', render: () => React.createElement(FileExplorerExpandable) }),
    }
  },
  { 
    id: 'Obsidian',
    label: 'Obsidian',
    data: { id: 'Obsidian', kind: 'widget', widgetId: 'jimcast-internal.obsidian-notes' } 
  },
  { 
    id: 'Rest-API',
    label: 'Rest-API',
    data: {
      id: 'Rest-API',
      kind: 'custom',
      render: () => ({ type: 'component', render: () => React.createElement(RestApiExpandable) }),
    }
  },
  { 
    id: 'Task-Management',
    label: 'Task-Management',
    data: {
      id:   'Task-Management',
      kind: 'custom',
      render: () => ({ type: 'component', render: () => React.createElement(TaskManagementExpandable) }),
    }
  }
];

const userListWidget = createWidget({
  id: "jimcast-customer-data.widget.user-list",
  showIn: ["default"],
  async render(context: ExecutionContext): Promise<WidgetContent<true>> {
    return {
      type: "grid-3",
      datas: QUICK_TOOLS.map((tool) => ({
        id: tool.id,
        attribute: { label1: tool.label, color1: context.host.theme.colors.green },
        action: { cmd: "true", then: "expand" as const },
      })),
      // no `expandable` here — it's already set above
      expandable: {                       // <-- descriptor-level, not content-level
        // enable: true,
        childs: QUICK_TOOLS.map((tool) => ({
          id: tool.id, kind: "widget" as const, widgetId: tool.id,
        })),
      },
    };
  },
});

const userListWidget = createWidget({
  id: "jimcast-customer-data.widget.user-list",
  showIn: ["default"],
  async render(context: ExecutionContext): Promise<WidgetContent> {
    const { green, fg, fg4 } = context.host.theme.colors;


    const quickTools = QUICK_TOOLS.map(tool => ({
      id: tool.id,
      attribute: { label1: tool.label, color1: green },
      action: { cmd: 'true', then: 'expand' },
    }));

    const quickToolExpandables = QUICK_TOOLS.map(tool => (
      tool.data
    ));

    return {
      type:  "grid-3",
      datas: quickTools,
      expandable: {
        enable: true,
        childs: quickToolExpandables,
      }
    };
  },
});

const userEmailBadgeWidget = createWidget({
  id: "jimcast-customer-data.widget.user-email-list",
  repeat: {
    enable:  true,
    seconds: 1,
  },
  async render(context: ExecutionContext): Promise<WidgetContent> {
    const { brightPurple, fg, fg4 } = context.host.theme.colors;

    const users = await fetchUsers();
    if (!users) return { type: "error", message: "Failed to load users." };

    return {
      type:  "rows",
      datas: users.map((user) => ({
        id: String(user.id),
        attribute: {
          label1: user.name, color1: fg,
          label2: user.email, color2: brightPurple,
          labelRight: user.role ?? "member", colorRight: fg4,
        },
        action: async (ctx: ExecutionContext) => {
          await ctx.showToast(`Switched to ${user.email}`);
        },
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const listUsersCommand = createCommand({
  id:       "jimcast-customer-data.command.user-list",
  title:    "List Users",
  subtitle: "Browse all users",
  keywords: ["users", "people", "accounts"],

  async execute(context: ExecutionContext): Promise<CommandItem[]> {
    const users = await fetchUsers();
    if (!users) {
      await context.showToast("Failed to load users.");
      return [];
    }

    return users.map((user) => ({
      id:        String(user.id),
      title:     user.name,
      subtitle:  user.email,
      accessory: user.role ?? "member",
      keywords:  [user.email],
      preview: {
        type:    "markdown",
        content: `## ${user.name}\n\n- **Email:** ${user.email}\n- **Role:** ${user.role ?? "member"}`,
      },
      actions: [
        {
          id:       `copy-email-${user.id}`,
          title:    "Copy Email",
          shortcut: "cmd+shift+c",
          async onAction() {
            await context.copyToClipboard(user.email);
            await context.showToast(`Copied: ${user.email}`);
          },
        },
        {
          id:       `view-user-${user.id}`,
          title:    "View Profile",
          shortcut: "cmd+return",
          async onAction() {
            await context.showToast(`Viewing: ${user.name}`);
          },
        },
      ],
    }));
  },
});

// ---------------------------------------------------------------------------
// Command groups
// ---------------------------------------------------------------------------

const userGroup = createCommandGroup({
  title:    "Users",
  commands: [listUsersCommand],
});

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default definePlugin({
  name:        "Customer Data List",
  description: "Customer Data List",
  commands:    [userGroup],
  widgets:     [userEmailBadgeWidget, userListWidget],
});
