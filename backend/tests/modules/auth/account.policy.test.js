import { describe, it, expect, vi } from "vitest";
import { AccountPolicy } from "#src/modules/auth/account.policy.js";
import { ForbiddenError, NotFoundError } from "#src/core/errors/index.js";

const build = () => {
  const userRepository = { updateById: vi.fn().mockResolvedValue(undefined) };
  return { policy: new AccountPolicy({ userRepository }), userRepository };
};

describe("AccountPolicy", () => {
  it("lets an active account through", async () => {
    const { policy } = build();

    await expect(policy.assertMaySignIn({ _id: "1", status: "Active" })).resolves.toBeUndefined();
  });

  it("gives a deleted account the same answer as a nonexistent one", async () => {
    // Anything more specific confirms that a deleted address once had an
    // account — exactly what someone probing for membership wants to learn.
    const { policy } = build();

    await expect(policy.assertMaySignIn({ _id: "1", status: "Deleted" })).rejects.toThrow(
      NotFoundError
    );
    await expect(policy.assertMaySignIn({ _id: "1", status: "Deleted" })).rejects.toThrow(
      "User not found"
    );
  });

  it("refuses a blocked account", async () => {
    const { policy } = build();

    await expect(policy.assertMaySignIn({ _id: "1", status: "Block" })).rejects.toThrow(
      ForbiddenError
    );
  });

  describe("suspension", () => {
    it("refuses while the suspension is running, and names the end date", async () => {
      const { policy } = build();
      const user = {
        _id: "1",
        status: "Suspended",
        suspendedUntil: new Date("2099-06-01T00:00:00Z"),
      };

      await expect(policy.assertMaySignIn(user)).rejects.toThrow(/suspended until/);
    });

    it("never quotes the moderator's reason", async () => {
      // moderationReason is the moderator's own wording and can identify
      // whoever reported them.
      const { policy } = build();
      const user = {
        _id: "1",
        status: "Suspended",
        suspendedUntil: new Date("2099-06-01"),
        moderationReason: "Reported by jane@example.com for harassment",
      };

      await expect(policy.assertMaySignIn(user)).rejects.toThrow(
        expect.objectContaining({
          message: expect.not.stringContaining("jane@example.com"),
        })
      );
    });

    it("lifts a suspension that has run out, on this sign-in", async () => {
      // Done here rather than by a nightly job: the only moment the answer
      // matters is when someone tries to get in, and a job would leave a user
      // locked out for up to a day after their suspension ended.
      const { policy, userRepository } = build();
      const user = {
        _id: "1",
        status: "Suspended",
        suspendedUntil: new Date("2020-01-01"),
      };

      await expect(policy.assertMaySignIn(user)).resolves.toBeUndefined();

      expect(user.status).toBe("Active");
      expect(userRepository.updateById).toHaveBeenCalledWith("1", {
        $set: {
          status: "Active",
          suspendedUntil: null,
          suspendedAt: null,
          moderationReason: null,
        },
      });
    });

    it("refuses an open-ended suspension with no end date", async () => {
      const { policy } = build();

      await expect(
        policy.assertMaySignIn({ _id: "1", status: "Suspended", suspendedUntil: null })
      ).rejects.toThrow("Your account is suspended. Please contact support.");
    });
  });
});
