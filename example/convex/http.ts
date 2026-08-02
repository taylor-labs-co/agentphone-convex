import { httpRouter } from "convex/server";
import { agentphone } from "./agentphone.js";

const http = httpRouter();
agentphone.registerRoutes(http);

export default http;
