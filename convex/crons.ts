import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// A single consolidated sweep (Constitution Principle I) — see
// convex/maintenance.ts for what it covers. Times are UTC; Convex runs at most
// one instance of a job at a time.
const crons = cronJobs();

crons.interval("sweep stale state", { seconds: 15 }, internal.maintenance.sweepAll);

export default crons;
