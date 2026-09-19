import { Suspense } from "react";
import { Outlet } from "react-router-dom";

/**
 * The page slot, with the boundary that route-level code splitting needs.
 *
 * Every screen in App.jsx is a React.lazy component, which suspends while its
 * chunk downloads. Something above it has to catch that, and where the boundary
 * sits decides what the member sees during the wait:
 *
 *   around <RouterProvider>  the whole window blanks, header and footer
 *                            included, and the page appears to reload on every
 *                            navigation.
 *   here, around <Outlet />  the chrome stays put and only the content area
 *                            swaps. Navigation reads as navigation.
 *
 * The fallback is deliberately not the full-screen Loader used elsewhere: this
 * renders inside the layout, so an `h-screen` spinner would push the footer a
 * viewport down and make the page jump when the chunk lands.
 *
 * It also carries the page's <main> landmark. The document had none, so screen
 * reader users had no "skip to content" target and every page began at the
 * header's nav. It lives here rather than in PageLayout because PageLayout has
 * six chrome branches: one <main> per branch is five chances to forget one,
 * and this element wraps the route content in all of them.
 */
export default function RouteOutlet() {
  return (
    <main id="main-content">
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] w-full items-center justify-center">
            <div className="loader" />
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </main>
  );
}
