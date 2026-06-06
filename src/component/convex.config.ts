import { defineComponent } from "convex/server";
import { v } from "convex/values";

const component = defineComponent("agentphone", {
  env: {
    AGENTPHONE_API_KEY: v.string(),
    AGENTPHONE_BASE_URL: v.optional(v.string()),
  },
});

export default component;
