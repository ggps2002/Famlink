import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { SocketProvider } from "@shared/realtime/SocketProvider";
import { store, persistor } from "@app/store";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * Everything the tree needs in place before a route renders, in the one order
 * that works.
 *
 * The nesting is not arbitrary:
 *
 *   GoogleOAuthProvider  outermost — the sign-in button mounts inside routes.
 *   Provider             the store, which PersistGate and every hook below read.
 *   PersistGate          holds rendering until the persisted session is rehydrated.
 *                        Render before this resolves and the first paint is
 *                        logged-out, which flips App's route table to the
 *                        logged-out branch and bounces a signed-in member.
 *   SocketProvider       opens the connection with the now-rehydrated user id.
 *
 * Kept out of main.jsx so tests can mount a subtree with the same providers the
 * app uses, instead of a hand-rolled approximation that drifts from it.
 */
export function Providers({ children }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <SocketProvider>{children}</SocketProvider>
        </PersistGate>
      </Provider>
    </GoogleOAuthProvider>
  );
}

export default Providers;
