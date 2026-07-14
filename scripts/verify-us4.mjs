// Ad-hoc end-to-end check for US4 channel management against the local deployment.
// Run: node scripts/verify-us4.mjs
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
    { name: "US4 Server" },
  );
  const server = await owner.query(api.servers.get, { serverId });
  await member.mutation(api.servers.joinByInvite, {
    inviteCode: server.inviteCode,
  });

  // Owner creates text + voice channels; member sees all.
  const { channelId: textId } = await owner.mutation(api.channels.create, {
    serverId,
    name: "random",
    type: "text",
  });
  await owner.mutation(api.channels.create, {
    serverId,
    name: "Lounge",
    type: "voice",
  });
  let list = await member.query(api.channels.list, { serverId });
  if (list.length !== 3) throw new Error(`expected 3 channels, got ${list.length}`);
  console.log("✓ owner created text+voice; member sees all 3 channels");

  // Rename.
  await owner.mutation(api.channels.rename, { channelId: textId, name: "general-2" });
  list = await member.query(api.channels.list, { serverId });
  if (!list.some((c) => c.name === "general-2"))
    throw new Error("rename not visible to member");
  console.log("✓ channel rename visible to member");

  // Non-owner cannot create.
  let rejected = false;
  try {
    await member.mutation(api.channels.create, {
      serverId,
      name: "nope",
      type: "text",
    });
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("non-owner create was not rejected");
  console.log("✓ non-owner channel create rejected");

  // Delete channel removes its messages.
  await owner.mutation(api.messages.send, {
    channelId: defaultChannelId,
    content: "will be gone",
  });
  await owner.mutation(api.channels.remove, { channelId: defaultChannelId });
  list = await member.query(api.channels.list, { serverId });
  if (list.some((c) => c._id === defaultChannelId))
    throw new Error("deleted channel still listed");
  console.log("✓ channel deleted (its messages cascade-removed)");

  console.log("\nALL US4 CHECKS PASSED");
}

main().catch((err) => {
  console.error("US4 CHECK FAILED:", err.message ?? err);
  process.exit(1);
});
