/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as calls from "../calls.js";
import type * as deliveries from "../deliveries.js";
import type * as events from "../events.js";
import type * as lib_resourceState from "../lib/resourceState.js";
import type * as messages from "../messages.js";
import type * as outbound from "../outbound.js";
import type * as request from "../request.js";
import type * as resources from "../resources.js";
import type * as subAccounts from "../subAccounts.js";
import type * as sync from "../sync.js";
import type * as validators from "../validators.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  calls: typeof calls;
  deliveries: typeof deliveries;
  events: typeof events;
  "lib/resourceState": typeof lib_resourceState;
  messages: typeof messages;
  outbound: typeof outbound;
  request: typeof request;
  resources: typeof resources;
  subAccounts: typeof subAccounts;
  sync: typeof sync;
  validators: typeof validators;
  webhooks: typeof webhooks;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {};
