import { createRoot } from "react-dom/client";
import App from "@app/App";
import Providers from "@app/Providers";
import MyToastContainer from "@shared/ui/toast";
import "./index.css";

// The entry point stays deliberately thin: mount the tree and nothing else.
// The provider stack lives in @app/Providers so tests can reuse it.
createRoot(document.getElementById("root")).render(
  <Providers>
    <App />
    <MyToastContainer />
  </Providers>
);
