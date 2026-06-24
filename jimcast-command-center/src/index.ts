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
// import { definePlugin, createCommand, createWidget } from "@jimcast/sdk";
//
// const helloCommand = createCommand({
//   id: "jimcast-command-center.greet",
//   title: "Say Hello",
//   subtitle: "Choose a greeting style",
//   keywords: ["hi", "greet", "welcome"],
//   async execute(context) {
//     const branch = context.project.branch ?? "unknown";
//     return [
//       {
//         id: "toast-greeting",
//         title: "Show a toast greeting",
//         subtitle: "Pops up a brief notification",
//         accessory: "toast",
//         actions: [
//           {
//             id: "show-toast",
//             title: "Show Greeting",
//             shortcut: "cmd+return",
//             async onAction() {
//               await context.showToast(`Hello from Jimcast! You're on branch: ${branch}`, {
//                 style: "success",
//               });
//             },
//           },
//         ],
//       },
//       {
//         id: "copy-greeting",
//         title: "Copy greeting to clipboard",
//         subtitle: "Copies a hello message you can paste anywhere",
//         accessory: "clipboard",
//         actions: [
//           {
//             id: "copy",
//             title: "Copy to Clipboard",
//             shortcut: "cmd+c",
//             async onAction() {
//               await context.copyToClipboard(`Hello from Jimcast! Branch: ${branch}`);
//               await context.showToast("Copied!", { style: "success", duration: 1500 });
//             },
//           },
//         ],
//       },
//     ];
//   },
// });
//
// const projectInfoCommand = createCommand({
//   id: "jimcast-command-center.project-info",
//   title: "Show Project Info",
//   subtitle: "Displays info about the current project",
//   keywords: ["info", "project", "repo", "branch"],
//   async execute(context) {
//     const { project } = context;
//     return [
//       {
//         id: "cwd",
//         title: project.cwd,
//         subtitle: "Working directory",
//         accessory: "path",
//         preview: {
//           type: "markdown",
//           content: `## Project Info\n\n- **CWD:** \`${project.cwd}\`\n- **Branch:** \`${project.branch ?? "none"}\`\n- **Remote:** \`${project.remoteName ?? "none"}\`\n- **Open PRs:** ${project.openPRs.length}`,
//         },
//         actions: [
//           {
//             id: "copy-path",
//             title: "Copy Path",
//             async onAction() {
//               await context.copyToClipboard(project.cwd);
//               await context.showToast("Path copied", { style: "success" });
//             },
//           },
//         ],
//       },
//       ...(project.branch ? [
//         {
//           id: "branch",
//           title: project.branch,
//           subtitle: "Current branch",
//           accessory: "branch",
//           actions: [
//             {
//               id: "copy-branch",
//               title: "Copy Branch Name",
//               async onAction() {
//                 await context.copyToClipboard(project.branch!);
//                 await context.showToast("Branch name copied", { style: "success" });
//               },
//             },
//           ] as const,
//         },
//       ] : []),
//     ];
//   },
// });
//
// const branchWidget = createWidget({
//   id: "jimcast-command-center.branch-widget",
//   defaultSlot: "below-input",
//   async render(context) {
//     const { project } = context;
//     return {
//       type: "rows",
//       rows: [
//         {
//           label: "branch",
//           value: project.branch ?? "none",
//           valueColor: project.branch ? "green" : "default",
//         },
//         {
//           label: "cwd",
//           value: project.cwd,
//         },
//       ],
//     };
//   },
// });
//
// export default definePlugin({
//   name: "Hello Test",
//   description: "A minimal example plugin showing the Jimcast SDK basics",
//   commands: [helloCommand, projectInfoCommand],
//   widgets: [userListWidget],
// });

import { createCommand, createCommandGroup, createWidget, definePlugin, type CommandItem, type ExecutionContext, type WidgetContent } from "@jimcast/sdk";

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
  id: "jimcast-external.widget.command-center.user-list",
  defaultSlot: "below-input",

  async render(context: ExecutionContext): Promise<WidgetContent> {
    const data: unknown = await fetch(
      "https://jsonplaceholder.typicode.com/users"
    ).then((r) => r.json());

    if (!isUserArray(data)) {
      return { type: "text", content: "Failed to load users." };
    }

    return {
      type: "rows",
      rows: data.slice(0, 5).map((user) => ({
        label: user.name,
        value: user.email,
        valueColor: "blue",
      })),
    };
  },
});

const userEmailBadgeWidget = createWidget({
  id: "jimcast-external.widget.command-center.user-email-list",
  defaultSlot: "below-input",

  async render(context: ExecutionContext): Promise<WidgetContent> {
    const data: unknown = await fetch(
      "https://jsonplaceholder.typicode.com/users"
    ).then((r) => r.json());

    if (!isUserArray(data)) {
      return { type: "text", content: "Failed to load users." };
    }

    return {
      type: "grid-3",
      cards: data.map((user) => ({
        id:    String(user.id),
        icon:  "👤",
        title: user.name,
        sub:   user.email,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const listUsersCommand = createCommand({
  id: "jimcast-external.command.command-center.user-list",
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
