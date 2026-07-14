// Ad-hoc end-to-end check for US3 messaging against the local deployment.
// Run: node scripts/verify-us3.mjs
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const url = process.env.VITE_CONVEX_URL || "http://127.0.0.1:3210";

async function signUp(name) {
  const client = new ConvexHttpClient(url);
  const res = await client.action(api.auth.signIn, {
    provider: "password",
    params: {
      email: `${name}+${Date.now()}@example.com`,
      password: "Password123!",
      flow: "signUp",
      name,
    },
  });
  client.setAuth(res.tokens.token);
  return client;
}

async function main() {
  const owner = await signUp("Owner");
  const member = await signUp("Member");

  const { serverId, defaultChannelId } = await owner.mutation(
    api.servers.create,
    { name: "US3 Server" },
  );
  const server = await owner.query(api.servers.get, { serverId });
  await member.mutation(api.servers.joinByInvite, {
    inviteCode: server.inviteCode,
  });

  // Owner sends; member sees it.
  const { messageId } = await owner.mutation(api.messages.send, {
    channelId: defaultChannelId,
    content: "hello from owner",
  });
  let page = await member.query(api.messages.list, {
    channelId: defaultChannelId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  if (page.page[0]?.content !== "hello from owner")
    throw new Error("member did not see the message");
  console.log("✓ member sees the sent message with author name", page.page[0].authorName);

  // Owner edits -> marked edited.
  await owner.mutation(api.messages.edit, { messageId, content: "edited text" });
  page = await member.query(api.messages.list, {
    channelId: defaultChannelId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  if (page.page[0]?.content !== "edited text" || !page.page[0]?.editedAt)
    throw new Error("edit not reflected / not marked edited");
  console.log("✓ edit reflected and marked edited");

  // Over-limit rejected.
  let rejected = false;
  try {
    await owner.mutation(api.messages.send, {
      channelId: defaultChannelId,
      content: "x".repeat(2001),
    });
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("over-2000 message was not rejected");
  console.log("✓ over-2000-char message rejected");

  // Delete -> gone.
  await owner.mutation(api.messages.remove, { messageId });
  page = await member.query(api.messages.list, {
    channelId: defaultChannelId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  if (page.page.length !== 0) throw new Error("message not deleted for member");
  console.log("✓ delete reflected for the other member");

  // Typing indicator.
  await owner.mutation(api.typing.ping, {
    scopeType: "channel",
    scopeId: defaultChannelId,
  });
  const typers = await member.query(api.typing.list, {
    scopeType: "channel",
    scopeId: defaultChannelId,
  });
  if (!typers.some((x) => x.name === "Owner"))
    throw new Error("typing indicator not visible");
  console.log("✓ typing indicator visible to the other member");

  console.log("\nALL US3 CHECKS PASSED");
}

main().catch((err) => {
  console.error("US3 CHECK FAILED:", err.message ?? err);
  process.exit(1);
});
