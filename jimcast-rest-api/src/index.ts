// [plugin] jimcast-rest-api/src/index.ts

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

async function loadTasks(_context: ExecutionContext): Promise<Task[]> {
  // const raw = await context.storage.get("tasks");
  const raw = ['test_1', 'test_2', 'test_3'].toString();
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
      type: "list",
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
      type: "list",
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

const taskManagementWidget = createWidget({
  id: "jimcast-rest-api.widget.task-management",
  showIn: ["default"],

  async renderQuery(context: ExecutionContext, query: string): Promise<WidgetContent> {
    const { green, fg, fg4 } = context.host.theme.colors;
    const trimmed = query.trim();

    if (trimmed) {
      return {
        type: "list",
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

function quickTool(id: string, label: string, widgetId: string): QuickTool {
  return { id, label, widgetId };
}

const QUICK_TOOLS: readonly QuickTool[] = [
  quickTool("File-Explorer",   "File Explorer",   fileExplorerWidget.id),
  quickTool("Rest-API",        "Rest-API",         restApiWidget.id),
  quickTool("Task-Management", "Task-Management",  taskManagementWidget.id),
];

const quickToolsExpandableChilds = QUICK_TOOLS.map((tool) => ({
  id:       tool.id,
  kind:     "widget" as const,
  widgetId: tool.widgetId,
}));

const quickToolsWidget = createWidget<true>({
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
    quickToolsWidget,
    restApiWidget,
    fileExplorerWidget,
    taskManagementWidget,
  ],
});
