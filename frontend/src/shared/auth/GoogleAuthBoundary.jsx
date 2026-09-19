import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * Mounts Google Identity Services, and only where a Google button is rendered.
 *
 * WHY THIS IS NOT IN THE ROOT PROVIDER STACK
 * `GoogleOAuthProvider` injects `accounts.google.com/gsi/client` the moment it
 * mounts. It used to sit outermost in `Providers`, so every visitor to the
 * marketing pages downloaded 98 KB of third-party JavaScript — 82 KB of it
 * unused, on the critical path, on a connection that has to fetch the app
 * bundle too — for a sign-in button those pages do not contain.
 *
 * `GoogleLogin` appears on exactly four screens: /login and the three
 * onboarding steps. All four are lazy route chunks, so scoping the provider to
 * them means the script is fetched when someone is actually about to sign in,
 * and never on a page that only wants to be read.
 *
 * This is the same shape as the `socket.io` fix in `useSocket`: a provider in
 * the root stack is a decision about what every page downloads, not just a
 * question of where context is convenient. Do not hoist it back.
 */
export default function GoogleAuthBoundary({ children }) {
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>;
}
