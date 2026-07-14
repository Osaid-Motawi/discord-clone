/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as calls from "../calls.js";
import type * as channels from "../channels.js";
import type * as crons from "../crons.js";
import type * as directMessages from "../directMessages.js";
import type * as http from "../http.js";
import type * as maintenance from "../maintenance.js";
import type * as messages from "../messages.js";
import type * as model_auth from "../model/auth.js";
import type * as model_cascade from "../model/cascade.js";
import type * as model_validators from "../model/validators.js";
import type * as presence from "../presence.js";
import type * as servers from "../servers.js";
import type * as signals from "../signals.js";
import type * as typing from "../typing.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  calls: typeof calls;
  channels: typeof channels;
  crons: typeof crons;
  directMessages: typeof directMessages;
  http: typeof http;
  maintenance: typeof maintenance;
  messages: typeof messages;
  "model/auth": typeof model_auth;
  "model/cascade": typeof model_cascade;
  "model/validators": typeof model_validators;
  presence: typeof presence;
  servers: typeof servers;
  signals: typeof signals;
  typing: typeof typing;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
