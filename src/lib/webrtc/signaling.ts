import type { PeerMesh } from "./PeerMesh";

export interface InboxSignal {
  _id: string;
  fromUserId: string;
  kind: "offer" | "answer" | "candidate";
  payload: string;
}

/**
 * Feed newly-arrived signals into the mesh, in delivery order, deduping by `_id`
 * so a signal isn't applied twice while its `ack` is still in flight, then ack each
 * once handled. ICE-candidate buffering until `remoteDescription` is set lives in
 * `PeerMesh` (it owns `pc.remoteDescription`); this module only sequences delivery.
 */
export async function processInboxSignals(
  signals: InboxSignal[],
  mesh: PeerMesh,
  processedIds: Set<string>,
  ack: (signalId: string) => void,
): Promise<void> {
  for (const signal of signals) {
    if (processedIds.has(signal._id)) continue;
    processedIds.add(signal._id);
    try {
      if (signal.kind === "candidate") {
        const candidate = JSON.parse(signal.payload) as RTCIceCandidateInit;
        await mesh.handleCandidate(signal.fromUserId, candidate);
      } else {
        const description = JSON.parse(
          signal.payload,
        ) as RTCSessionDescriptionInit;
        await mesh.handleDescription(signal.fromUserId, description);
      }
    } finally {
      ack(signal._id);
    }
  }
}
