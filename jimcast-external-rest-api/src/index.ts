// [plugin] jimcast-external-rest-api/src/index.ts

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

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface LastResult {
  status: number;
  ok:     boolean;
  ms:     number;
  at:     string;
  body:   string;
}

// ---------------------------------------------------------------------------
// Storage — last result + last-used field values, so the form reopens
// pre-filled with whatever was last sent rather than always resetting.
// ---------------------------------------------------------------------------

const LAST_RESULT_KEY = "last-result";
const LAST_VALUES_KEY = "last-values";

async function loadLastResult(ctx: ExecutionContext): Promise<LastResult | null> {
  const raw = await ctx.storage.get(LAST_RESULT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as LastResult; } catch { return null; }
}

async function loadLastValues(ctx: ExecutionContext): Promise<Record<string, string>> {
  const raw = await ctx.storage.get(LAST_VALUES_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
}

// ---------------------------------------------------------------------------
// Request execution — real fetch, run inside the plugin process (no shell
// interpolation / escaping needed now that values arrive as real params
// rather than being spliced into a curl command string).
// ---------------------------------------------------------------------------

async function runRequest(
  ctx:    ExecutionContext,
  method: string,
  url:    string,
  body:   string,
): Promise<LastResult> {
  const start = Date.now();
  const hasBody = method !== "GET" && method !== "DELETE" && body.trim().length > 0;

  let status = 0;
  let text   = "";
  try {
    const res = await fetch(url, {
      method,
      ...(hasBody ? { headers: { "Content-Type": "application/json" }, body } : {}),
    });
    status = res.status;
    text   = await res.text();
  } catch (e) {
    text = `Request failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  const ms = Date.now() - start;
  const last: LastResult = {
    status,
    ok:   status >= 200 && status < 300,
    ms,
    at:   new Date().toISOString(),
    body: text.length > 2000 ? text.slice(0, 2000) + "…" : text,
  };

  await ctx.storage.set(LAST_RESULT_KEY, JSON.stringify(last));
  ctx.appendOutput(`[${method}] ${url} -> ${status} (${ms}ms)`);
  ctx.appendOutput(text);

  return last;
}

// ---------------------------------------------------------------------------
// Widget — quick_tools "external-custom" entry, id matches the config key:
//
//   "jimcast-external-rest-api.widget.external-rest-api": {
//     "label": "Rest API",
//     "kind": "external-custom"
//   }
//
// Renders a real form (method/url/body) instead of fixed presets. Submission
// runs the request inside this process via runRequest — see the action fn
// below, which now receives the submitted field values directly (values arg
// on WidgetActionFn), rather than the earlier preset-button approach that
// only ever replayed a fixed config.
// ---------------------------------------------------------------------------

const restApiWidget = createWidget({
  id: "jimcast-external-rest-api.widget.external-rest-api",
  showSection: true,
  async render(ctx: ExecutionContext): Promise<WidgetContent> {
    const last   = await loadLastResult(ctx);
    const values = await loadLastValues(ctx);

    const statusNote = last
      ? `Last: ${last.status} · ${last.ms}ms · ${last.ok ? "ok" : "failed"}`
      : "Not run yet";

    return {
      type: "form",
      fields: [
        {
          id: "method", kind: "select", label: "Method",
          options: (["GET", "POST", "PUT", "PATCH", "DELETE"] as HttpMethod[])
            .map(m => ({ label: m, value: m })),
          default: values.method ?? "GET",
        },
        {
          id: "url", kind: "text", label: "URL",
          placeholder: "https://api.example.com/endpoint",
          default: values.url ?? "",
        },
        {
          id: "body", kind: "textarea", label: "Body (JSON)",
          placeholder: '{ "hello": "jimcast" }',
          default: values.body ?? "",
        },
      ],
      submitLabel: `Send  —  ${statusNote}`,
      action: async (submitted) => {
        const method = submitted?.method ?? "GET";
        const url    = submitted?.url ?? "";
        const body   = submitted?.body ?? "";

        if (!url.trim()) {
          await ctx.showToast("URL is required", { style: "failure" });
          return;
        }

        await ctx.storage.set(LAST_VALUES_KEY, JSON.stringify({ method, url, body }));
        await ctx.showToast(`Sending ${method} ${url}…`);

        const result = await runRequest(ctx, method, url, body);
        await ctx.showToast(
          result.ok ? `${result.status} OK (${result.ms}ms)` : `Failed: ${result.status}`,
          { style: result.ok ? "success" : "failure" },
        );
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Commands — same capability from the command bar. Since CommandItem has no
// form-input equivalent, this stays a "run the last-submitted request again"
// convenience rather than trying to collect fresh input here.
// ---------------------------------------------------------------------------

const rerunLastCommand = createCommand({
  id:       "jimcast-external-rest-api.command.rerun-last",
  title:    "Re-run Last REST Request",
  subtitle: "Repeats the most recently submitted request",
  keywords: ["rest", "api", "http", "curl"],

  async execute(context: ExecutionContext): Promise<CommandItem[]> {
    const values = await loadLastValues(context);
    const last   = await loadLastResult(context);

    if (!values.url) {
      await context.showToast("No previous request to re-run.");
      return [];
    }

    const url    = values.url;
    const method = values.method ?? "GET";
    const body   = values.body ?? "";

    return [
      {
        id:        "rerun",
        title:     `${method} ${url}`,
        subtitle:  last ? `Last: ${last.status} · ${last.ms}ms` : "Not run yet",
        keywords:  [url],
        preview: {
          type:    "markdown",
          content: last
            ? `## Last Result\n\n- **Status:** ${last.status}\n- **Time:** ${last.ms}ms\n- **At:** ${last.at}\n\n\`\`\`\n${last.body}\n\`\`\``
            : `## ${method} ${url}\n\nNot run yet.`,
        },
        actions: [
          {
            id:    "run-again",
            title: "Run Again",
            shortcut: "cmd+return",
            async onAction() {
              const result = await runRequest(context, method, url, body);
              await context.showToast(
                result.ok ? `${result.status} OK (${result.ms}ms)` : `Failed: ${result.status}`,
                { style: result.ok ? "success" : "failure" },
              );
            },
          },
          {
            id:    "copy-url",
            title: "Copy URL",
            shortcut: "cmd+shift+c",
            async onAction() {
              await context.copyToClipboard(url);
              await context.showToast(`Copied: ${url}`);
            },
          },
        ],
      },
    ];
  },
});

const restApiGroup = createCommandGroup({
  title:    "REST API",
  commands: [rerunLastCommand],
});

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default definePlugin({
  name:        "REST API Tool",
  description: "Send ad-hoc REST requests from a live form in the quick tools panel",
  commands:    [restApiGroup],
  widgets:     [restApiWidget],
});
