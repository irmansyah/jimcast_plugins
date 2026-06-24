import { 
  createCommand, 
  createCommandGroup, 
  createWidget, 
  definePlugin, 
  type CommandItem, 
  type ExecutionContext, 
  type WidgetContent } from "@jimcast/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
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

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

const userListWidget = createWidget({
  id: "jimcast-customer-data.widget.user-list",
  defaultSlot: "below-input",
  async render(context: ExecutionContext): Promise<WidgetContent> {
    const { brightAqua, fg4, brightYellow } = context.host.theme.colors;

    const data: unknown = await fetch(
      "https://jsonplaceholder.typicode.com/users"
    ).then((r) => r.json());

    if (!isUserArray(data)) {
      return { type: "text", content: "Failed to load users." };
    }

    return {
      type: "rows",
      rows: data.slice(0, 5).map((user) => ({
        label:      user.name,
        labelColor: fg4,
        value:      user.email,
        valueColor: brightAqua,
        accessory:      user.role ?? "member",
        accessoryColor: brightYellow,
      })),
    };
  },
});

const userEmailBadgeWidget = createWidget({
  id: "jimcast-customer-data.widget.user-email-list",
  defaultSlot: "below-input",
  // title: "Email List",
  // showIn:  ['default'],
  // repeat:  true,
  // seconds: 5,
  // action:  { cmd: 'tmux switch-client -t {id}', then: 'both' },
  async render(context: ExecutionContext): Promise<WidgetContent> {
    const { brightPurple, fg, fg4 } = context.host.theme.colors;

    const data: unknown = await fetch(
      "https://jsonplaceholder.typicode.com/users"
    ).then((r) => r.json());

    if (!isUserArray(data)) {
      return { type: "text", content: "Failed to load users." };
    }

    return {
      type: "grid-3",
      cards: data.map((user) => ({
        id:         String(user.id),
        icon:       "👤",
        title:      user.name,
        titleColor: fg,
        sub:        user.email,
        subColor:   brightPurple,
        right:      user.role ?? "member",
        rightColor: fg4,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const listUsersCommand = createCommand({
  id: "jimcast-external.command.customer.user-list",
  title: "List Users",
  subtitle: "Browse all users",
  keywords: ["users", "people", "accounts"],

  async execute(context: ExecutionContext): Promise<CommandItem[]> {
    const data: unknown = await fetch(
      "https://jsonplaceholder.typicode.com/users"
    ).then((r) => r.json());

    if (!isUserArray(data)) {
      await context.showToast("Failed to load users.");
      return [];
    }

    return data.map((user) => ({
      id: String(user.id),
      title: user.name,
      subtitle: user.email,
      accessory: user.role ?? "member",
      keywords: [user.email],
      preview: {
        type: "markdown",
        content: `## ${user.name}\n\n- **Email:** ${user.email}\n- **Role:** ${user.role ?? "member"}`,
      },
      actions: [
        {
          id: `copy-email-${user.id}`,
          title: "Copy Email",
          shortcut: "cmd+shift+c",
          async onAction() {
            await context.showToast(`Copied: ${user.email}`);
          },
        },
        {
          id: `view-user-${user.id}`,
          title: "View Profile",
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
  title: "Users",
  commands: [listUsersCommand],
});

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default definePlugin({
  name: "User Directory",
  description: "Browse and manage users from the command bar",
  commands: [userGroup],
  widgets: [userListWidget, userEmailBadgeWidget],
});
