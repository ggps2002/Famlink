import { describe, it, expect, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useBodyScrollLock, lockBodyScroll } from "@shared/lib/bodyScrollLock";

/**
 * The behaviours that the hand-written locks got wrong.
 *
 * The first test is the bug itself: a component that unmounts while holding the
 * lock must not leave the page locked. That is what a hamburger menu does every
 * time someone taps a link inside it, and it is why a phone could arrive on
 * /dashboard unable to scroll.
 */

const overflow = () => document.body.style.overflow;

function Locker({ active = true }) {
  useBodyScrollLock(active);
  return null;
}

describe("useBodyScrollLock", () => {
  beforeEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("releases when the component unmounts mid-lock", () => {
    const view = render(<Locker />);
    expect(overflow()).toBe("hidden");

    // The navigation. Nothing sets `active` back to false first — the whole
    // component simply goes away, which is what React Router does to a header
    // when a link inside its open menu is tapped.
    view.unmount();

    expect(overflow()).toBe("");
  });

  it("releases when the lock is turned off without unmounting", () => {
    const view = render(<Locker active />);
    expect(overflow()).toBe("hidden");

    view.rerender(<Locker active={false} />);
    expect(overflow()).toBe("");
  });

  it("does not lock while inactive", () => {
    render(<Locker active={false} />);
    expect(overflow()).toBe("");
  });

  it("stays locked until the last holder releases", () => {
    // A modal opened over a menu. Closing the modal must not hand the page back
    // while the menu still has it.
    const menu = render(<Locker />);
    const modal = render(<Locker />);
    expect(overflow()).toBe("hidden");

    modal.unmount();
    expect(overflow()).toBe("hidden");

    menu.unmount();
    expect(overflow()).toBe("");
  });

  it("restores the value it found rather than guessing one", () => {
    document.body.style.overflow = "scroll";

    const view = render(<Locker />);
    expect(overflow()).toBe("hidden");

    view.unmount();
    expect(overflow()).toBe("scroll");
  });

  it("ignores a release that is called twice", () => {
    const releaseA = lockBodyScroll();
    const releaseB = lockBodyScroll();

    releaseA();
    releaseA(); // StrictMode-style double cleanup must not drop B's lock.
    expect(overflow()).toBe("hidden");

    releaseB();
    expect(overflow()).toBe("");
  });
});
