import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  requireUser,
  requireMember,
  requireOwner,
} from "./model/auth";
import { normalizeName, SERVER_NAME_MAX_CHARS } from "./model/validators";
import { deleteChannelCascade } from "./model/cascade";

// Servers, invites, and membership (FR-005–FR-010a).

function newInviteCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

/** Create a server, its owner membership, and the default "general" text channel. */
export const create = mutation({
  args: { name: v.string(), imageUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const name = normalizeName(args.name, SERVER_NAME_MAX_CHARS, "Server name");

    const serverId = await ctx.db.insert("servers", {
      name,
      imageUrl: args.imageUrl?.trim() || undefined,
      ownerId: userId,
      inviteCode: newInviteCode(),
    });
    await ctx.db.insert("serverMembers", {
      serverId,
      userId,
      role: "owner",
    });
    const defaultChannelId = await ctx.db.insert("channels", {
      serverId,
      name: "general",
      type: "text",
      isDefault: true,
    });
    return { serverId, defaultChannelId };
  },
});

/** Servers the caller belongs to (for the server rail). */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const servers = await Promise.all(
      memberships.map((m) => ctx.db.get(m.serverId)),
    );
    return servers.filter((s): s is NonNullable<typeof s> => s !== null);
  },
});

/** A single server the caller is a member of. */
export const get = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.serverId);
    return await ctx.db.get(args.serverId);
  },
});

/** Members of a server with profile fields (combine with presence for status). */
export const listMembers = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.serverId);
    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
    return await Promise.all(
      memberships.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          userId: m.userId,
          role: m.role,
          name: user?.name,
          image: user?.image,
        };
      }),
    );
  },
});

/** Rename a server (owner only, FR-009). */
export const rename = mutation({
  args: { serverId: v.id("servers"), name: v.string() },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.serverId);
    const name = normalizeName(args.name, SERVER_NAME_MAX_CHARS, "Server name");
    await ctx.db.patch(args.serverId, { name });
    return null;
  },
});

/** Regenerate the invite code, invalidating the previous one (owner only, FR-006). */
export const generateInvite = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.serverId);
    const inviteCode = newInviteCode();
    await ctx.db.patch(args.serverId, { inviteCode });
    return { inviteCode };
  },
});

/** Join a server via a valid invite code (FR-007). Idempotent for existing members. */
export const joinByInvite = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const code = args.inviteCode.trim();
    const server = await ctx.db
      .query("servers")
      .withIndex("by_invite", (q) => q.eq("inviteCode", code))
      .unique();
    if (server === null) {
      throw new Error("This invite link is invalid or has expired.");
    }
    const existing = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", server._id).eq("userId", userId),
      )
      .unique();
    if (existing === null) {
      await ctx.db.insert("serverMembers", {
        serverId: server._id,
        userId,
        role: "member",
      });
    }
    return { serverId: server._id };
  },
});

/** Remove a member (owner only). Their authored messages are retained (FR-010/010a). */
export const removeMember = mutation({
  args: { serverId: v.id("servers"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx, args.serverId);
    if (args.userId === ownerId) {
      throw new Error("The owner cannot be removed.");
    }
    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_user", (q) =>
        q.eq("serverId", args.serverId).eq("userId", args.userId),
      )
      .unique();
    if (membership !== null) {
      await ctx.db.delete(membership._id);
    }
    // Drop the removed member from any of this server's active calls (FR-010).
    await dropUserFromServerCalls(ctx, args.serverId, args.userId);
    return null;
  },
});

/** Delete a server and cascade its channels, messages, members, calls (owner only). */
export const remove = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.serverId);
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
    for (const channel of channels) {
      await deleteChannelCascade(ctx, channel._id);
    }
    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", args.serverId))
      .collect();
    for (const m of memberships) {
      await ctx.db.delete(m._id);
    }
    await ctx.db.delete(args.serverId);
    return null;
  },
});

// --- server-specific helper ---

async function dropUserFromServerCalls(
  ctx: MutationCtx,
  serverId: Id<"servers">,
  userId: Id<"users">,
) {
  const parts = await ctx.db
    .query("callParticipants")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const part of parts) {
    const call = await ctx.db.get(part.callId);
    if (call === null || call.scopeType !== "channel" || !call.channelId) {
      continue;
    }
    const channel = await ctx.db.get(call.channelId);
    if (channel !== null && channel.serverId === serverId) {
      await ctx.db.delete(part._id);
    }
  }
}
