// Ad-hoc end-to-end check for US7 DM video calls against the local deployment.
// Validates the Convex contract (activeForThread visibility, join/leave, single
// active call across a voice channel and a DM). Cannot exercise real browser
// WebRTC — see verify-us6.mjs note.
// Run: node scripts/verify-us7.mjs
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
  client._id = (await client.query(api.users.me, {}))._id;
  return client;
}

async function main() {
  const a = await signUp("Ada");
  const b = await signUp("Bea");

  const { serverId } = await a.mutation(api.servers.create, { name: "US7 Server" });
  const server = await a.query(api.servers.get, { serverId });
  await b.mutation(api.servers.joinByInvite, { inviteCode: server.inviteCode });
  const bId = (await a.query(api.servers.listMembers, { serverId })).find(
    (m) => m.name === "Bea",
  ).userId;
  const { threadId } = await a.mutation(api.directMessages.openThread, {
    otherUserId: bId,
  });

  // Before anyone starts a call, B sees none.
  const before = await b.query(api.calls.activeForThread, { threadId });
  if (before !== null) throw new Error("expected no active DM call yet");
  console.log("✓ no active DM call before anyone starts one");

  // A starts the call; B's reactive query flips to non-null (US7 #1).
  const { callId } = await a.mutation(api.calls.join, {
    scopeType: "dm",
    threadId,
  });
  const active = await b.query(api.calls.activeForThread, { threadId });
  if (active?.callId !== callId) throw new Error("B did not see the started call");
  console.log("✓ B sees the DM call the instant A starts it (reactive)");

  // B joins.
  const joined = await b.mutation(api.calls.join, { scopeType: "dm", threadId });
  if (joined.callId !== callId) throw new Error("B joined a different call");
  let roster = await a.query(api.calls.roster, { callId });
  if (roster.length !== 2) throw new Error("expected both participants on roster");
  console.log("✓ B joins the same 1-on-1 call");

  // Media toggle reflected (US7 #2).
  await a.mutation(api.calls.setMedia, { callId, micEnabled: false });
  roster = await b.query(api.calls.roster, { callId });
  if (roster.find((p) => p.userId === a._id)?.micEnabled !== false)
    throw new Error("mic toggle not reflected to the other participant");
  console.log("✓ mic toggle reflected to the other participant");

  // A leaves; call ends for A only, B remains (US7 #3).
  await a.mutation(api.calls.leave, { callId });
  roster = await b.query(api.calls.roster, { callId });
  if (roster.length !== 1 || roster[0].userId !== bId)
    throw new Error("leave did not end the call for A only");
  console.log("✓ leaving ends the call for that participant only; B remains");

  // Single active call across a voice channel and this DM (FR-032).
  const { channelId } = await a.mutation(api.channels.create, {
    serverId,
    name: "Lounge",
    type: "voice",
  });
  const { callId: voiceCallId } = await a.mutation(api.calls.join, {
    scopeType: "channel",
    channelId,
  });
  const { callId: dmCallId2 } = await a.mutation(api.calls.join, {
    scopeType: "dm",
    threadId,
  });
  const voiceRoster = await b.query(api.calls.roster, { callId: voiceCallId });
  if (voiceRoster.length !== 0)
    throw new Error("A was not removed from the voice call after joining the DM call");
  console.log("✓ joining the DM call removed A from the voice channel call (single active call)");
  void dmCallId2;

  console.log("\nALL US7 CHECKS PASSED");
  console.log(
    "NOTE: real browser WebRTC (camera/mic, RTCPeerConnection negotiation) was NOT exercised — requires two real browser tabs.",
  );
}

main().catch((err) => {
  console.error("US7 CHECK FAILED:", err.message ?? err);
  process.exit(1);
});
