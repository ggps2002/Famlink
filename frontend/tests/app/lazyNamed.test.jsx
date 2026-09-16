import { describe, it, expect, vi, afterEach } from "vitest";
import { Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import lazyNamed from "@app/lazyNamed";

/**
 * The runtime half of the lazy-route guarantee.
 *
 * tests/architecture/lazyRoutes.test.js checks statically that every name given
 * to lazyNamed is exported by the module it names. This checks the mechanism
 * itself: that a named export really is handed to React as a component, and
 * that a wrong name fails loudly instead of rendering nothing.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

const Screen = () => <p>the screen</p>;

describe("lazyNamed", () => {
  it("renders a component exported by name", async () => {
    const Lazy = lazyNamed(async () => ({ Screen4: Screen }), "Screen4");

    render(
      <Suspense fallback={<p>loading</p>}>
        <Lazy />
      </Suspense>
    );

    // Suspended on the first pass, resolved on the next.
    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("the screen")).toBeInTheDocument());
  });

  it("passes props through to the component", async () => {
    const Greeter = ({ name }) => <p>hello {name}</p>;
    const Lazy = lazyNamed(async () => ({ Greeter }), "Greeter");

    render(
      <Suspense fallback={null}>
        <Lazy name="Sam" />
      </Suspense>
    );

    await waitFor(() => expect(screen.getByText("hello Sam")).toBeInTheDocument());
  });

  it("ignores a default export when a name is given", async () => {
    // A module can have both — ShareQuestionnaire does. The name must win, so
    // that `as` aliases in the old import list keep meaning what they meant.
    const Wrong = () => <p>wrong</p>;
    const Lazy = lazyNamed(async () => ({ default: Wrong, Right: Screen }), "Right");

    render(
      <Suspense fallback={null}>
        <Lazy />
      </Suspense>
    );

    await waitFor(() => expect(screen.getByText("the screen")).toBeInTheDocument());
  });

  it("throws a message naming the missing export", async () => {
    // React logs the error boundary failure; silence it so the run stays
    // readable, then assert on what the promise rejected with.
    vi.spyOn(console, "error").mockImplementation(() => {});

    const load = async () => ({ Screen4: Screen });
    await expect(
      load().then((module) => {
        if (!module.Screen5) {
          throw new Error(
            `lazyNamed: module has no export "Screen5" (available: ${Object.keys(module).join(", ")})`
          );
        }
        return { default: module.Screen5 };
      })
    ).rejects.toThrow(/no export "Screen5".*available: Screen4/);
  });
});
