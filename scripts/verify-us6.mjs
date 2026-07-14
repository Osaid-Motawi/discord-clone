// Ad-hoc end-to-end check for US6 calls/signaling backend against the local
// deployment. This validates the Convex contract (join/roster/media/signals/
// capacity/single-active-call/leave) — it cannot exercise real browser WebRTC
// (camera/mic/RTCPeerConnection), which requires two real browser tabs.
// Run: node scripts/verify-us6.mjs
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
  const owner = await signUp("Owner");
  const member = await signUp("Member");

  const { serverId } = await owner.mutation(api.servers.create, {
    name: "US6 Server",
  });
  const server = await owner.query(api.servers.get, { serverId });
  await member.mutation(api.servers.joinByInvite, {
    inviteCode: server.inviteCode,
  });
  const { channelId: voiceA } = await owner.mutation(api.channels.create, {
    serverId,
    name: "Lounge",
    type: "voice",
  });
  const { channelId: voiceB } = await owner.mutation(api.channels.create, {
    serverId,
    name: "Second Room",
    type: "voice",
  });

  // Join + roster.
  const { callId } = await owner.mutation(api.calls.join, {
    scopeType: "channel",
    channelId: voiceA,
  });
  const joinedByMember = await member.mutation(api.calls.join, {
    scopeType: "channel",
    channelId: voiceA,
  });
  if (joinedByMember.callId !== callId) throw new Error("second joiner got a different call");
  let roster = await owner.query(api.calls.roster, { callId });
  if (roster.length !== 2) throw new Error(`expected roster of 2, got ${roster.length}`);
  console.log("✓ both members join the same call; roster has 2 participants");

  // Channel list shows connected members (FR-029).
  let connected = await owner.query(api.calls.connectedByChannel, { serverId });
  const loungeEntry = connected.find((c) => c.channelId === voiceA);
  if (loungeEntry.participants.length !== 2)
    throw new Error("connectedByChannel does not show both participants");
  console.log("✓ connectedByChannel shows both participants for the voice channel");

  // setMedia toggles reflected on roster (FR-026/027).
  await owner.mutation(api.calls.setMedia, { callId, cameraEnabled: true });
  roster = await member.query(api.calls.roster, { callId });
  if (!roster.find((p) => p.userId === owner._id)?.cameraEnabled)
    throw new Error("setMedia cameraEnabled not reflected");
  console.log("✓ setMedia (camera on) reflected to the other participant");

  // Signaling: offer, ICE candidate, ack.
  await owner.mutation(api.signals.send, {
    callId,
    toUserId: member._id,
    kind: "offer",
    payload: JSON.stringify({ type: "offer", sdp: "fake" }),
  });
  await owner.mutation(api.signals.send, {
    callId,
    toUserId: member._id,
    kind: "candidate",
    payload: JSON.stringify({ candidate: "fake" }),
  });
  let inbox = await member.query(api.signals.inbox, { callId });
  if (inbox.length !== 2) throw new Error(`expected 2 queued signals, got ${inbox.length}`);
  if (inbox[0].kind !== "offer" || inbox[1].kind !== "candidate")
    throw new Error("signals not delivered in order");
  for (const s of inbox) await member.mutation(api.signals.ack, { signalId: s._id });
  inbox = await member.query(api.signals.inbox, { callId });
  if (inbox.length !== 0) throw new Error("signals not cleared after ack");
  console.log("✓ signals delivered in order and acked (consumed)");

  // Capacity: fill to 4, 5th rejected.
  const extra = [];
  for (const n of ["C", "D"]) {
    const c = await signUp(n);
    await c.mutation(api.servers.joinByInvite, { inviteCode: server.inviteCode });
    await c.mutation(api.calls.join, { scopeType: "channel", channelId: voiceA });
    extra.push(c);
  }
  const fifth = await signUp("E");
  await fifth.mutation(api.servers.joinByInvite, { inviteCode: server.inviteCode });
  let capacityRejected = false;
  try {
    await fifth.mutation(api.calls.join, { scopeType: "channel", channelId: voiceA });
  } catch {
    capacityRejected = true;
  }
  if (!capacityRejected) throw new Error("5th participant was not rejected at capacity");
  console.log("✓ 5th participant rejected once the call is at capacity (4)");

  // Single active call: owner joins voiceB, leaving voiceA's call.
  const { callId: callB } = await owner.mutation(api.calls.join, {
    scopeType: "channel",
    channelId: voiceB,
  });
  roster = await member.query(api.calls.roster, { callId });
  if (roster.find((p) => p.userId === owner._id))
    throw new Error("owner still on the previous call's roster");
  console.log("✓ joining a second call removes the owner from the first (single active call)");

  // Leave.
  await owner.mutation(api.calls.leave, { callId: callB });
  const rosterB = await member.query(api.calls.roster, { callId: callB }).catch(() => null);
  console.log("✓ leave completed (roster query after leave: " + (rosterB ? rosterB.length : "n/a") + ")");

  console.log("\nALL US6 BACKEND CHECKS PASSED");
  console.log(
    "NOTE: real browser WebRTC (camera/mic, RTCPeerConnection negotiation) was NOT exercised here — that requires two real browser tabs and cannot be verified headlessly.",
  );
}

main().catch((err) => {
  console.error("US6 CHECK FAILED:", err.message ?? err);
  process.exit(1);
});
