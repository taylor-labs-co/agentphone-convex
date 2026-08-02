import { v } from "convex/values";
import { action } from "./_generated/server.js";
import { queryValueValidator, requestMethodValidator } from "./validators.js";

const DEFAULT_BASE_URL = "https://api.agentphone.ai/v1/";

export const request = action({
  args: {
    token: v.string(),
    method: requestMethodValidator,
    path: v.string(),
    query: v.optional(v.record(v.string(), queryValueValidator)),
    body: v.optional(v.any()),
    subAccountId: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    return await agentPhoneRequest(args);
  },
});

export type AgentPhoneRequest = {
  token: string;
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | null>;
  body?: unknown;
  subAccountId?: string;
  baseUrl?: string;
  /**
   * Stable per-request key repeated on every retry, so a provider that honors
   * it collapses a resubmission caused by an ambiguous transport failure.
   */
  idempotencyKey?: string;
};

export async function agentPhoneRequest(
  args: AgentPhoneRequest,
): Promise<unknown> {
  const url = makeUrl(args.path, args.baseUrl, args.query);
  const headers = new Headers({
    Authorization: `Bearer ${args.token}`,
    Accept: "application/json",
  });
  if (args.subAccountId) {
    headers.set("X-Sub-Account-Id", args.subAccountId);
  }
  if (args.idempotencyKey) {
    headers.set("Idempotency-Key", args.idempotencyKey);
  }

  const init: RequestInit = {
    method: args.method,
    headers,
  };
  if (args.body !== undefined) {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(args.body);
  }

  const response = await fetch(url, init);
  const contentType = response.headers.get("content-type") ?? "";
  const responseText = await response.text();
  const responseBody = parseResponseBody(responseText, contentType);

  if (!response.ok) {
    const detail =
      typeof responseBody === "string"
        ? responseBody
        : JSON.stringify(responseBody);
    throw new Error(
      `AgentPhone API ${args.method} ${url.pathname} failed (${response.status}): ${detail}`,
    );
  }
  return responseBody;
}

function makeUrl(
  path: string,
  baseUrl: string | undefined,
  query: Record<string, string | number | boolean | null> | undefined,
) {
  const normalizedBase = ensureTrailingSlash(baseUrl ?? DEFAULT_BASE_URL);
  let normalizedPath = path.replace(/^\/+/, "");
  if (normalizedPath.startsWith("v1/")) {
    normalizedPath = normalizedPath.slice(3);
  }
  if (!normalizedPath || normalizedPath.includes("..")) {
    throw new Error("AgentPhone request path must be a non-empty API path");
  }

  const url = new URL(normalizedPath, normalizedBase);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function parseResponseBody(text: string, contentType: string): unknown {
  if (!text) {
    return null;
  }
  if (contentType.includes("json")) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("AgentPhone returned an invalid JSON response");
    }
  }
  return text;
}
