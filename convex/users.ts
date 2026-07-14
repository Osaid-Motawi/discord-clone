import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./model/auth";
import { normalizeDisplayName } from "./model/validators";

// Profile functions (FR-002). Every function is guarded (Constitution Principle IV).

/** The current authenticated user's full profile. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    return await ctx.db.get(userId);
  },
});

/** A public profile subset for displaying authors/members. */
export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const user = await ctx.db.get(args.userId);
    if (user === null) return null;
    return { _id: user._id, name: user.name, image: user.image };
  },
});

/** Update the caller's own display name and/or avatar (FR-002). */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const patch: { name?: string; image?: string } = {};
    if (args.name !== undefined) {
      patch.name = normalizeDisplayName(args.name);
    }
    if (args.image !== undefined) {
      patch.image = args.image.trim();
    }
    await ctx.db.patch(userId, patch);
    return null;
  },
});
