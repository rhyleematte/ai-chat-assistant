// Auth integration — wraps @lovable.dev/cloud-auth-js for OAuth sign-in flows.
// This package handles the OAuth redirect loop and session management.
import { createLovableAuth } from "@lovable.dev/cloud-auth-js";

type SignInOptions = Parameters<ReturnType<typeof createLovableAuth>["signInWithOAuth"]>[1];

const auth = createLovableAuth();

export const authClient = {
  auth,
  signInWithOAuth: async (provider: "google" | "apple" | "microsoft", opts?: SignInOptions) => {
    const result = await auth.signInWithOAuth(provider, {
      redirectTo: opts?.redirectTo ?? window.location.origin,
      ...opts,
    });
    return result;
  },
  signOut: () => auth.signOut(),
  getSession: () => auth.getSession(),
};
