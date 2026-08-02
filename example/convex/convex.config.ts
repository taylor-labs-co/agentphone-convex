import { defineApp } from "convex/server";
import agentphone from "agentphone-convex/convex.config.js";

const app = defineApp();
app.use(agentphone);

export default app;
