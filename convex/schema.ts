import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// All tables + per-access-pattern indexes (data-model.md).
// The `users` table is the Convex Auth built-in, overridden to keep the fields
// we use; avatar maps to the built-in `image` field (research.md §0).
export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()), // display name (FR-002); enforce 1–32 in mutations
    image: v.optional(v.string()), // avatar URL (FR-002)
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  }).index("email", ["email"]),

  presence: defineTable({
    userId: v.id("users"),
    lastSeen: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_lastSeen", ["lastSeen"]),

  servers: defineTable({
    name: v.string(),
    imageUrl: v.optional(v.string()),
    ownerId: v.id("users"),
    inviteCode: v.string(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_invite", ["inviteCode"]),

  serverMembers: defineTable({
    serverId: v.id("servers"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("member")),
  })
    .index("by_server", ["serverId"])
    .index("by_user", ["userId"])
    .index("by_server_user", ["serverId", "userId"]),

  channels: defineTable({
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
    isDefault: v.optional(v.boolean()),
  })
    .index("by_server", ["serverId"])
    .index("by_server_type", ["serverId", "type"]),

  messages: defineTable({
    channelId: v.id("channels"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
  }).index("by_channel", ["channelId"]),

  directMessageThreads: defineTable({
    userA: v.id("users"), // canonically the smaller id
    userB: v.id("users"),
    // Last-read timestamps per side, for unread badges (post-v1 addition —
    // see spec.md FR-023a). A thread has exactly 2 participants, so two
    // optional fields are simpler than a separate read-state table.
    lastReadA: v.optional(v.number()),
    lastReadB: v.optional(v.number()),
  })
    .index("by_pair", ["userA", "userB"])
    .index("by_userA", ["userA"])
    .index("by_userB", ["userB"]),

  directMessages: defineTable({
    threadId: v.id("directMessageThreads"),
    authorId: v.id("users"),
    content: v.string(),
    editedAt: v.optional(v.number()),
  }).index("by_thread", ["threadId"]),

  typingIndicators: defineTable({
    scopeType: v.union(v.literal("channel"), v.literal("dm")),
    scopeId: v.string(), // channelId or threadId as string
    userId: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_scope", ["scopeType", "scopeId"])
    .index("by_scope_user", ["scopeType", "scopeId", "userId"]),

  calls: defineTable({
    scopeType: v.union(v.literal("channel"), v.literal("dm")),
    channelId: v.optional(v.id("channels")),
    threadId: v.optional(v.id("directMessageThreads")),
    active: v.boolean(),
  })
    .index("by_channel", ["channelId"])
    .index("by_thread", ["threadId"])
    .index("by_active", ["active"]),

  callParticipants: defineTable({
    callId: v.id("calls"),
    userId: v.id("users"),
    micEnabled: v.boolean(),
    cameraEnabled: v.boolean(),
    lastSeen: v.number(),
  })
    .index("by_call", ["callId"])
    .index("by_user", ["userId"])
    .index("by_call_user", ["callId", "userId"])
    .index("by_lastSeen", ["lastSeen"]),

  signals: defineTable({
    callId: v.id("calls"),
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    kind: v.union(
      v.literal("offer"),
      v.literal("answer"),
      v.literal("candidate"),
    ),
    payload: v.string(), // opaque serialized SDP/ICE (justified external boundary)
  })
    .index("by_recipient", ["callId", "toUserId"])
    .index("by_call", ["callId"]),
});
