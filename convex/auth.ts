import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// Convex Auth with the Password provider (signup/login) — research.md §0/§2.
// `npx @convex-dev/auth` generates JWT_PRIVATE_KEY / JWKS and wires SITE_URL.
//
// The `profile` callback maps the sign-up form fields onto the built-in `users`
// table: display name -> `name`, avatar URL -> `image` (FR-002).
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params): { email: string } & Record<string, string> {
        const out: { email: string } & Record<string, string> = {
          email: params.email as string,
        };
        const name = typeof params.name === "string" ? params.name.trim() : "";
        if (name) out.name = name;
        const image =
          typeof params.image === "string" ? params.image.trim() : "";
        if (image) out.image = image;
        return out;
      },
    }),
  ],
});
