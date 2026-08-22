// [plugins] jimcast-react-rest/src/backend.ts
import { defineWebviewBackend, defineCommand } from "@jimcast/react-sdk/server";

const ping = defineCommand({
  id: "ping",
  title: "REST: Ping",
  description: "No-op example command — proves the nested command-line plumbing end to end.",
  run: async (args) => ({ pong: true, echo: args, at: Date.now() }),
});

defineWebviewBackend({}, [ping]);
