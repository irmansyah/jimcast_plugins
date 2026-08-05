// [plugin] jimcast-external-customer-data/src/index.ts

import {
  createCommand,
  createCommandGroup,
  createWidget,
  definePlugin,
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

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

const userEmailBadgeWidget = createWidget({
  id: "jimcast-external-customer-data.widget.user-email-list",
  showIn: ['default'],
  sectionTitleShow: true,
  async render(ctx: ExecutionContext): Promise<WidgetContent> {
    const { brightPurple, fg, fg4 } = ctx.host.theme.colors;

    const users = await fetchUsers();
    if (!users) return { type: "error", message: "Failed to load users." };

    return {
      type:  "grid-2",
      datas: users.map((user) => ({
        id: String(user.id),
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
  ],
});
