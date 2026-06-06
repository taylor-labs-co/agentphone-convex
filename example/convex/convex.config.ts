import { defineApp } from "convex/server";
import { v } from "convex/values";
import agentphone from "@taylor-labs/agentphone-convex/convex.config.js";

const app = defineApp({
  env: {
    AGENTPHONE_API_KEY: v.string(),
    AGENTPHONE_BASE_URL: v.optional(v.string()),
  },
});

app.use(agentphone, {
  name: "agentphone",
  httpPrefix: "/agentphone",
  env: {
    AGENTPHONE_API_KEY: app.env.AGENTPHONE_API_KEY,
    AGENTPHONE_BASE_URL: app.env.AGENTPHONE_BASE_URL,
  },
});

export default app;
