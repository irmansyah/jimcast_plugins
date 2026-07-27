// [plugin] jimcast-rest-api/src/index.ts

import {
  createCommand,
  createCommandGroup,
  createWidget,
  definePlugin,
  type CommandResult,
  type ExecutionContext,
  type WidgetContent,
} from "@jimcast/sdk";

// ---------------------------------------------------------------------------
// Widgets
// ---------------------------------------------------------------------------

const quickToolsWidget = createWidget<true>({
  id: "jimcast-rest-api.widget.rest-api",
  showIn: ["default"],
  expandable: true,

  async render(context: ExecutionContext): Promise<WidgetContent<true>> {
    const { yellow } = context.host.theme.colors;

    return {
      type: "text",
      data: {
        id: "",
        attribute: { 
          label1: "test 1",
          color1: yellow, 
        },
        action: { cmd: "true", then: "expand" as const },
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const listQuickToolsCommand = createCommand({
    id: "jimcast-rest-api.command.rest-api",
    title: "List Users",
    subtitle: "Browse all users",
    keywords: ["users", "people", "accounts"],
    execute: function(_context: ExecutionContext): Promise<CommandResult> {
        throw new Error("Function not implemented.");
    }
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
  name:        "Customer Data List",
  description: "Customer Data List",
  commands:    [userGroup],
  widgets:     [
    quickToolsWidget,
  ],
});
