import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import { action } from "./_generated/server.js";
import { agentPhoneRequest } from "./request.js";

const connectionArgs = {
  token: v.string(),
  scope: v.string(),
  subAccountId: v.optional(v.string()),
  baseUrl: v.optional(v.string()),
};

const paginationArgs = {
  limit: v.optional(v.number()),
  offset: v.optional(v.number()),
};

const syncResult = v.object({
  synced: v.number(),
  response: v.any(),
});

type SyncOutput = { synced: number; response: unknown };

/**
 * Reconcile the sub-account registry with AgentPhone. Sub-accounts belong to
 * the master account, so this never sends a sub-account header.
 */
export const subAccounts = action({
  args: {
    token: v.string(),
    scope: v.string(),
    baseUrl: v.optional(v.string()),
    ...paginationArgs,
  },
  returns: syncResult,
  handler: async (ctx, args): Promise<SyncOutput> => {
    const response = await get(args, "sub-accounts", pagination(args));
    const synced: number = await ctx.runMutation(
      internal.subAccounts.upsertFromResponse,
      { scope: args.scope, response },
    );
    return { synced, response };
  },
});

export const agents = action({
  args: { ...connectionArgs, ...paginationArgs },
  returns: syncResult,
  handler: async (ctx, args): Promise<SyncOutput> => {
    const response = await get(args, "agents", pagination(args));
    const synced: number = await ctx.runMutation(
      internal.resources.upsertAgentsFromResponse,
      { scope: args.scope, response },
    );
    return { synced, response };
  },
});

export const numbers = action({
  args: { ...connectionArgs, ...paginationArgs },
  returns: syncResult,
  handler: async (ctx, args): Promise<SyncOutput> => {
    const response = await get(args, "numbers", pagination(args));
    const synced: number = await ctx.runMutation(
      internal.resources.upsertNumbersFromResponse,
      { scope: args.scope, response },
    );
    return { synced, response };
  },
});

export const conversations = action({
  args: {
    ...connectionArgs,
    ...paginationArgs,
    agentId: v.optional(v.string()),
    numberId: v.optional(v.string()),
  },
  returns: syncResult,
  handler: async (ctx, args): Promise<SyncOutput> => {
    const response = await get(args, "conversations", {
      ...pagination(args),
      ...(args.agentId && { agent_id: args.agentId }),
      ...(args.numberId && { number_id: args.numberId }),
    });
    const synced: number = await ctx.runMutation(
      internal.resources.upsertConversationsFromResponse,
      { scope: args.scope, response },
    );
    return { synced, response };
  },
});

export const messages = action({
  args: {
    ...connectionArgs,
    conversationId: v.optional(v.string()),
    numberId: v.optional(v.string()),
    limit: v.optional(v.number()),
    before: v.optional(v.string()),
    after: v.optional(v.string()),
  },
  returns: syncResult,
  handler: async (ctx, args): Promise<SyncOutput> => {
    if (Boolean(args.conversationId) === Boolean(args.numberId)) {
      throw new Error("Provide exactly one of conversationId or numberId");
    }
    const parent = args.conversationId
      ? `conversations/${encodeURIComponent(args.conversationId)}`
      : `numbers/${encodeURIComponent(args.numberId!)}`;
    const response = await get(args, `${parent}/messages`, {
      ...(args.limit !== undefined && { limit: args.limit }),
      ...(args.before && { before: args.before }),
      ...(args.after && { after: args.after }),
    });
    const synced: number = await ctx.runMutation(
      internal.resources.upsertMessagesFromResponse,
      { scope: args.scope, response },
    );
    return { synced, response };
  },
});

export const calls = action({
  args: {
    ...connectionArgs,
    ...paginationArgs,
    agentId: v.optional(v.string()),
    numberId: v.optional(v.string()),
    status: v.optional(v.string()),
    direction: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  returns: syncResult,
  handler: async (ctx, args): Promise<SyncOutput> => {
    const path = args.numberId
      ? `numbers/${encodeURIComponent(args.numberId)}/calls`
      : args.agentId
        ? `agents/${encodeURIComponent(args.agentId)}/calls`
        : "calls";
    const response = await get(args, path, {
      ...pagination(args),
      ...(args.status && { status: args.status }),
      ...(args.direction && { direction: args.direction }),
      ...(args.search && { search: args.search }),
    });
    const synced: number = await ctx.runMutation(
      internal.resources.upsertCallsFromResponse,
      { scope: args.scope, response },
    );
    return { synced, response };
  },
});

type Connection = {
  token: string;
  subAccountId?: string;
  baseUrl?: string;
};

async function get(
  args: Connection,
  path: string,
  query?: Record<string, string | number | boolean | null>,
) {
  return await agentPhoneRequest({
    token: args.token,
    method: "GET",
    path,
    ...(query && { query }),
    ...(args.subAccountId && { subAccountId: args.subAccountId }),
    ...(args.baseUrl && { baseUrl: args.baseUrl }),
  });
}

function pagination(args: { limit?: number; offset?: number }) {
  return {
    ...(args.limit !== undefined && { limit: args.limit }),
    ...(args.offset !== undefined && { offset: args.offset }),
  };
}
