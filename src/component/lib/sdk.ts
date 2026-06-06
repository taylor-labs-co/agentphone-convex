import { AgentPhoneClient } from "agentphone";

import { env } from "../_generated/server.js";

const DEFAULT_BASE_URL = "https://api.agentphone.ai";

export type AgentPhoneResource =
  | "agents"
  | "numbers"
  | "messages"
  | "conversations"
  | "calls"
  | "webhooks"
  | "agentWebhooks"
  | "usage";

export function getAgentPhoneClient() {
  return new AgentPhoneClient({
    token: env.AGENTPHONE_API_KEY,
    ...(env.AGENTPHONE_BASE_URL
      ? { environment: env.AGENTPHONE_BASE_URL }
      : { environment: DEFAULT_BASE_URL }),
  });
}

export async function callAgentPhoneSdk(
  resource: AgentPhoneResource,
  method: string,
  args?: unknown,
) {
  const client = getAgentPhoneClient() as unknown as Record<
    AgentPhoneResource,
    Record<string, (request?: unknown) => Promise<unknown>>
  >;
  const resourceClient = client[resource];
  const sdkMethod = resourceClient?.[method];
  if (typeof sdkMethod !== "function") {
    throw new Error(`AgentPhone SDK method not found: ${resource}.${method}`);
  }
  return args === undefined
    ? sdkMethod.call(resourceClient)
    : sdkMethod.call(resourceClient, args);
}
