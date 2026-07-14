// Ad-hoc end-to-end check for US2 against the local deployment.
// Run: node scripts/verify-us2.mjs
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

  const { serverId } = await owner.mutation(api.servers.create, {
    name: "Verify Server",
  });
  const server = await owner.query(api.servers.get, { serverId });
  if (server?.name !== "Verify Server") throw new Error("create failed");
  console.log(`✓ created server with invite code ${server.inviteCode}`);

  await member.mutation(api.servers.joinByInvite, {
    inviteCode: server.inviteCode,
  });
  let members = await owner.query(api.servers.listMembers, { serverId });
  if (members.length !== 2) throw new Error(`expected 2 members, got ${members.length}`);
  console.log("✓ member joined via invite; listMembers shows 2");

  await owner.mutation(api.servers.rename, { serverId, name: "Renamed" });
  const renamed = await owner.query(api.servers.get, { serverId });
  if (renamed?.name !== "Renamed") throw new Error("rename failed");
  console.log("✓ owner renamed the server");

  const memberId = members.find((m) => m.role === "member")?.userId;
  await owner.mutation(api.servers.removeMember, { serverId, userId: memberId });
  let removedOk = false;
  try {
    await member.query(api.servers.get, { serverId });
  } catch {
    removedOk = true;
  }
  if (!removedOk) throw new Error("removed member can still read server");
  console.log("✓ removed member lost access");

  console.log("\nALL US2 CHECKS PASSED");
}

main().catch((err) => {
  console.error("US2 CHECK FAILED:", err.message ?? err);
  process.exit(1);
});
