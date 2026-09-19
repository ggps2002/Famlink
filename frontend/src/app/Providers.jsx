import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { SocketProvider } from "@shared/realtime/SocketProvider";
import { store, persistor } from "@app/store";

/**
 * Everything the tree needs in place before a route renders, in the one order
 * that works.
 *
 * The nesting is not arbitrary:
 *
 *   (GoogleOAuthProvider is deliberately NOT here — see
 *    shared/auth/GoogleAuthBoundary. It injects Google's 98 KB script on
 *    mount, which at this level meant every marketing visitor paid for a
 *    sign-in button their page does not have.)
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
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <SocketProvider>{children}</SocketProvider>
      </PersistGate>
    </Provider>
  );
}

export default Providers;
