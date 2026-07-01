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
import { definePlugin, createCommand, createWidget, type ExecutionContext, type WidgetContent } from "@jimcast/sdk";

const helloCommand = createCommand({
  id: "jimcast-hello-test.greet",
  title: "Say Hello",
  subtitle: "Choose a greeting style",
  keywords: ["hi", "greet", "welcome"],
  async execute(context) {
    const branch = "unknown";
    return [
      {
        id: "toast-greeting",
        title: "Show a toast greeting",
        subtitle: "Pops up a brief notification",
        accessory: "toast",
        actions: [
          {
            id: "show-toast",
            title: "Show Greeting",
            shortcut: "cmd+return",
            async onAction() {
              await context.showToast(`Hello from Jimcast! You're on branch: ${branch}`, {
                style: "success",
              });
            },
          },
        ],
      },
      {
        id: "copy-greeting",
        title: "Copy greeting to clipboard",
        subtitle: "Copies a hello message you can paste anywhere",
        accessory: "clipboard",
        actions: [
          {
            id: "copy",
            title: "Copy to Clipboard",
            shortcut: "cmd+c",
            async onAction() {
              await context.copyToClipboard(`Hello from Jimcast! Branch: ${branch}`);
              await context.showToast("Copied!", { style: "success", duration: 1500 });
            },
          },
        ],
      },
    ];
  },
});

const branchWidget = createWidget({
  id: "jimcast-hello-test.branch-widget",
  defaultSlot: "below-input",
  async render(context: ExecutionContext): Promise<WidgetContent> {
    const { yellow, aqua } = context.host.theme.colors;
    return {
      type: "rows",
      datas: [
        {
          id: 'branch',
          attribute: {
            label1: 'branch',
            labelRight: "none",
            colorRight: yellow,
          },
          action:  { cmd: 'echo branch', then: 'both' },
        },
        {
          id: 'cwd',
          attribute: {
            label1: 'cwd',
            labelRight: "none",
            colorRight: aqua,
          },
          action:  { cmd: 'echo cwd', then: 'both' },
        },
      ],
    };
  },
});

export default definePlugin({
  name: "Hello Test",
  description: "A minimal example plugin showing the Jimcast SDK basics",
  commands: [helloCommand],
  widgets: [branchWidget],
});
