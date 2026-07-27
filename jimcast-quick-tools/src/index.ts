// [plugin] jimcast-quick-tools/src/index.ts

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

async function loadTasks(context: ExecutionContext): Promise<Task[]> {
  const raw = await context.storage.get("tasks");
  // const raw = ['test_1', 'test_2', 'test_3'].toString();
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
  id: "jimcast-quick-tools.widget.rest-api",
  async render(context: ExecutionContext): Promise<WidgetContent> {
    const { green, fg4 } = context.host.theme.colors;
    const sourceUrl = "https://jsonplaceholder.typicode.com/users";
    const trimmed = sourceUrl.trim();

    if (!trimmed) {
      return { type: "text", data: {
          id: "",
          attribute: { label1: "Type a URL to GET, or `METHOD url` (e.g. POST https://…)" },
      } };
    }

    const [maybeMethod = "", ...rest] = trimmed.split(/\s+/);
    const isMethod = (HTTP_METHODS as readonly string[]).includes(maybeMethod.toUpperCase());
    const method   = isMethod ? (maybeMethod.toUpperCase() as typeof HTTP_METHODS[number]) : "GET";
    const url      = isMethod ? rest.join(" ") : trimmed;
    
    if (!url) 
      return { type: "text", data: {
          id: "",
          attribute: { label1: "Missing URL..." },
      } };

    return {
      type: "list",
      datas: [
        {
          id: "send",
          attribute: { label1: `${method} ${url}`, color1: green, labelRight: "send", colorRight: fg4 },
          // WidgetActionFn — runs in-process via context.exec, not the
          // undefined bare `shell()` global the old version called.
          action: async () => {
            const escapedUrl = url.replace(/'/g, "'\\''");
            const result = await context.exec(
              `curl -s -o /tmp/jimcast_rest_body -w '%{http_code}' -X ${method} '${escapedUrl}'`,
              { timeoutMs: 15_000, ignoreExitCode: true },
            );
            const status = parseInt(result.stdout.trim(), 10) || null;
            if (execFailed(result) && !status) {
              await context.showToast("Request failed", { style: "failure", message: "Check the URL and your network connection" });
              return;
            }
            await context.showToast(
              `Response: ${status ?? "?"}`,
              { style: status && status < 400 ? "success" : "failure" },
            );
          },
        },
      ],
    };
  },
});

const fileExternalWidget = createWidget({
  id: "jimcast-quick-tools.widget.file-external",
  async render(context: ExecutionContext): Promise<WidgetContent> {
    const { fg, fg4 } = context.host.theme.colors;

    const result = await context.exec("ls -1 ~/Downloads", { timeoutMs: 5_000, ignoreExitCode: true });
    if (execFailed(result)) {
      return { type: "error", message: "Failed to list directory." };
    }

    const entries = result.stdout.split("\n").filter((line) => line && line !== "./");
    if (entries.length === 0) {
      return { 
        type: "text", 
        data: {
          id: "",
          attribute: { label1: "Empty directory."},
        } 
      };
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
        action: async () => {
          // await context.copyToClipboard(entry);
          await context.showToast(`Copied: ${entry}`);
        },
      })),
    };
  },
});

const managementWidget = createWidget({
  id: "jimcast-quick-tools.widget.management",
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
            action: async () => {
              const tasks = await loadTasks(context);
              tasks.push({ id: crypto.randomUUID(), text: trimmed, done: false });
              await saveTasks(context, tasks);
              await context.showToast("Task added");
            },
          },
        ],
      };
    }

    const tasks = await loadTasks(context);
    if (tasks.length === 0) {
      return { type: "text", data: {
          id: "",
          attribute: { label1: "No tasks yet — type to add one." },
        }};
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
        action: async () => {
          const current = await loadTasks(context);
          const updated = current.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t));
          await saveTasks(context, updated);
          await context.showToast(task.done ? "Marked open" : "Marked done");
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

function quickTools(id: string, label: string, widgetId: string): QuickTool {
  return { id, label, widgetId };
}

const QUICK_TOOLS: readonly QuickTool[] = [
  quickTools("file_external",   "File External",    fileExternalWidget.id),
  quickTools("rest_api",        "Rest-API",         restApiWidget.id),
  quickTools("Management",      "Management",       managementWidget.id),
];

const restApisExpandableChilds = QUICK_TOOLS.map((tool) => ({
  id:       tool.id,
  kind:     "widget" as const,
  widgetId: tool.widgetId,
}));

const quickToolsWidget = createWidget<true>({
  id: "jimcast-quick-tools.widget.quick-tools",
  showIn: ["default"],
  expandable: true,
  // showSection: false,

  async render(context: ExecutionContext): Promise<WidgetContent<true>> {
    const { yellow } = context.host.theme.colors;

    return {
      type: "rows",
      datas: QUICK_TOOLS.map((tool) => ({
        id: tool.id,
        attribute: { 
          label1: tool.label, 
          color1: yellow, 
        },
        action: { cmd: "true", then: "expand" as const },
      })),
      expandable: restApisExpandableChilds,
    };
  },
});

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const listQuickToolsCommand = createCommand({
  id:       "jimcast-quick-tools.command.quick-tools",
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
  commands: [listQuickToolsCommand],
});

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default definePlugin({
  name:        "External Quick Tools",
  description: "External Quick Tools",
  commands:    [userGroup],
  widgets:     [
    quickToolsWidget,
    restApiWidget,
    fileExternalWidget,
    managementWidget,
  ],
});
