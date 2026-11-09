// [plugin] jimcast-external-customer-data/src/index.ts

import {
  createCommand,
  createCommandGroup,
  createWidget,
  definePlugin,
  type CommandItem,
  type ExecutionContext,
  type WidgetCliCommand,
  type WidgetContent,
  type WidgetItem,
  type WidgetKeyAction,
  type WidgetKeyContext,
} from "@jimcast/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id:    number;
  name:  string;
  email: string;
  role?: string;
}

// ---------------------------------------------------------------------------
// Data (cached, so `refresh` has something to invalidate)
// ---------------------------------------------------------------------------

const CACHE_MS = 60_000;
let cache: { at: number; users: User[] } | null = null;

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

async function getUsers(): Promise<User[] | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.users;
  const users = await fetchUsers();
  if (users) cache = { at: Date.now(), users };
  return users ?? cache?.users ?? null;   // stale data beats an error
}

// ---------------------------------------------------------------------------
// Widget helpers
// ---------------------------------------------------------------------------

/**
 * Every item id this widget renders starts with this. It is the `owns` of the
 * widget's `cli` and `keys` specs: core uses it to find the widget on screen.
 */
const OWNS = "cd";
const rowId = (u: User) => `${OWNS}:${u.id}`;
const userIdOf = (itemId?: string | null) =>
  itemId && itemId.startsWith(`${OWNS}:`) ? Number(itemId.slice(OWNS.length + 1)) : null;

/** A synthetic item for ctx.dispatch: runs, then core re-renders the widget. */
const refreshItem = (): WidgetItem => ({
  id: `${OWNS}-act:refresh`,
  action: { run: async () => { cache = null; }, then: "refresh" },
});

const keepFocus = (ctx: WidgetKeyContext) =>
  ctx.focusedItemId ? { focus: { id: ctx.focusedItemId } } : undefined;

async function findUser(key: string): Promise<User | undefined> {
  const users = (await getUsers()) ?? [];
  return users.find((u) => String(u.id) === key || u.email.toLowerCase() === key.toLowerCase());
}

// ---------------------------------------------------------------------------
// Widget: keys + CLI
// ---------------------------------------------------------------------------

// Remap in config.json / config_section.json:
//   "key_bindings": { "customers": { "copy_email": ["c", "ctrl+c"], "refresh": "" } }
const KEY_ACTIONS: WidgetKeyAction[] = [
  {
    id: "copy_email", title: "Copy the email of the row under the cursor", default: "c",
    async run(ctx) {
      const id = userIdOf(ctx.focusedItemId);
      if (id === null) return;
      const user = await findUser(String(id));
      if (!user) return;
      await ctx.copyToClipboard(user.email);
      await ctx.showToast(`Copied: ${user.email}`);
    },
  },
  {
    id: "refresh", title: "Reload the user list", default: "r",
    run: (ctx) => ctx.dispatch(refreshItem(), keepFocus(ctx)),
  },
];

// jimcast widget command customers <command> ...
const CLI_COMMANDS: WidgetCliCommand[] = [
  {
    id: "list", title: "Print the users", description: "--json for machine-readable output",
    async run(ctx) {
      const users = await getUsers();
      if (!users) throw new Error("failed to load users");
      if (ctx.args.includes("--json")) return users;
      return users.map((u) => `${u.id}\t${u.name}\t${u.email}`).join("\n");
    },
  },
  {
    id: "copy", args: ["id|email"], title: "Copy a user's email to the clipboard",
    async run(ctx) {
      const key = ctx.args.find((a) => !a.startsWith("--"));
      if (!key) throw new Error("copy needs a user id or email");
      const user = await findUser(key);
      if (!user) throw new Error(`no such user: ${key}`);
      await ctx.copyToClipboard(user.email);
      return `Copied ${user.email}`;
    },
  },
  {
    id: "refresh", title: "Reload the user list (the widget re-renders)",
    async run(ctx) {
      await ctx.dispatch(refreshItem());
      return "Refreshed.";
    },
  },
];

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

const userEmailBadgeWidget = createWidget({
  // Keep the id: users already reference it from their config. The part before
  // the first "." must be this plugin's folder name in ~/.jimcast/plugins.
  id: "jimcast-external-customer-data.widget.user-email-list",
  showIn: ["default"],
  // was `sectionTitleShow: true`, which the descriptor no longer has
  section: { title: "Customers", titleShow: true },

  cli:  { id: "customers", owns: OWNS, commands: CLI_COMMANDS },
  keys: { id: "customers", owns: OWNS, actions: KEY_ACTIONS },

  async render(ctx: ExecutionContext): Promise<WidgetContent> {
    const { brightPurple, fg, fg4 } = ctx.host.theme.colors;

    const users = await getUsers();
    if (!users) return { type: "error", message: "Failed to load users." };

    return {
      type:  "grid-2",
      datas: users.map((user): WidgetItem => ({
        id: rowId(user),                       // stable, and starts with OWNS
        attribute: {
          label1: user.name, color1: fg,
          label2: user.email, color2: brightPurple,
          labelRight: user.role ?? "member", colorRight: fg4,
        },
        action: async () => {
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
  id:       "jimcast-external-customer-data.command.user-list",
  title:    "List Users",
  subtitle: "Browse all users",
  keywords: ["users", "people", "accounts"],

  async execute(context: ExecutionContext): Promise<CommandItem[]> {
    const users = await getUsers();
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
  ],
});
