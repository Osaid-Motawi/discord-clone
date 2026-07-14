// Ad-hoc end-to-end check that Convex Auth signup/login works against the local
// deployment. Not part of the test suite; run manually with `node scripts/verify-signin.mjs`.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const url = process.env.VITE_CONVEX_URL || "http://127.0.0.1:3210";
const email = `smoke+${Date.now()}@example.com`;
const password = "Password123!";
const name = "Smoke Test";

async function main() {
  // 1. Sign up
  const signUpClient = new ConvexHttpClient(url);
  const signUp = await signUpClient.action(api.auth.signIn, {
    provider: "password",
    params: { email, password, flow: "signUp", name },
  });
  const token = signUp?.tokens?.token;
  if (!token) throw new Error("Sign-up returned no access token");
  console.log("✓ sign up succeeded, got access token");

  // 2. Use the session token to read the authenticated profile
  signUpClient.setAuth(token);
  const me = await signUpClient.query(api.users.me, {});
  if (me?.name !== name) throw new Error(`Profile name mismatch: ${me?.name}`);
  console.log(`✓ authenticated users.me returned "${me.name}" (${me._id})`);

  // 3. Sign in again with the same credentials on a fresh client
  const signInClient = new ConvexHttpClient(url);
  const signIn = await signInClient.action(api.auth.signIn, {
    provider: "password",
    params: { email, password, flow: "signIn" },
  });
  if (!signIn?.tokens?.token) throw new Error("Sign-in returned no access token");
  console.log("✓ sign in with the same credentials succeeded");

  console.log("\nALL SIGN-IN CHECKS PASSED");
}

main().catch((err) => {
  console.error("SIGN-IN CHECK FAILED:", err.message ?? err);
  process.exit(1);
});
