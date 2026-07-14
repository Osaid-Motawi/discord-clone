import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// Recurring cleanup. Consolidated further in Polish (T056); for now it bounds the
// presence table. Times are UTC; Convex runs at most one instance of a job at a time.
const crons = cronJobs();

crons.interval(
  "sweep stale presence",
  { seconds: 30 },
  internal.presence.sweepStale,
);

export default crons;
