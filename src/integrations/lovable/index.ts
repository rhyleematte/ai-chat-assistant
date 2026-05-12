// Auth integration — wraps @lovable.dev/cloud-auth-js for OAuth sign-in flows.
import { createLovableAuth } from "@lovable.dev/cloud-auth-js";

type SignInOptions = Parameters<ReturnType<typeof createLovableAuth>["signInWithOAuth"]>[1];

const _auth = createLovableAuth();

export const authClient = {
  /** The raw auth instance — use signInWithOAuth for all auth flows. */
  auth: _auth,

  signInWithOAuth: async (
    provider: "google" | "apple" | "microsoft",
    opts?: SignInOptions,
  ) => {
    return _auth.signInWithOAuth(provider, opts);
  },
};
