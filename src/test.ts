import type { TestConvex } from "convex-test";

import schema from "./component/schema.js";

export const agentPhoneComponentModules = {
  "./component/_generated/api.js": () => import("./component/_generated/api.js"),
  "./component/_generated/server.js": () =>
    import("./component/_generated/server.js"),
  "./component/agents.js": () => import("./component/agents.js"),
  "./component/calls.js": () => import("./component/calls.js"),
  "./component/conversations.js": () => import("./component/conversations.js"),
  "./component/http.js": () => import("./component/http.js"),
  "./component/messages.js": () => import("./component/messages.js"),
  "./component/numbers.js": () => import("./component/numbers.js"),
  "./component/outbound.js": () => import("./component/outbound.js"),
  "./component/resources.js": () => import("./component/resources.js"),
  "./component/state.js": () => import("./component/state.js"),
  "./component/sync.js": () => import("./component/sync.js"),
  "./component/usage.js": () => import("./component/usage.js"),
  "./component/webhooks.js": () => import("./component/webhooks.js"),
};

export const agentPhoneComponentSchema = schema;

export function registerAgentPhoneComponent(
  t: TestConvex<any>,
  options: {
    componentPath?: string;
    modules?: Record<string, () => Promise<any>>;
  } = {},
) {
  t.registerComponent(
    options.componentPath ?? "agentphone",
    schema as any,
    options.modules ?? agentPhoneComponentModules,
  );
  return t;
}
