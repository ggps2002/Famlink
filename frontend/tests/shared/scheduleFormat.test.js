import { describe, it, expect } from "vitest";

import {
  SHARE_SCHEDULES,
  normalizeShareSchedule,
  formatCareTypeLabel,
} from "@shared/lib/scheduleFormat";

describe("share schedules", () => {
  it("offers exactly two", () => {
    expect(SHARE_SCHEDULES).toEqual(["Full-time", "Part-time"]);
  });

  it("reads every spelling the questionnaires ever wrote", () => {
    // Two questionnaires and an edit form wrote this field, and they disagreed:
    // caregivers answered "Full-time", families "Full-time care", and the share
    // editor lowercased whatever it was handed. Same share, four spellings.
    for (const stored of ["Full-time", "Full-time care", "full-time care", "Full Time", "fulltime"]) {
      expect(normalizeShareSchedule(stored)).toBe("Full-time");
    }
    for (const stored of ["Part-time", "Part-time care", "part-time care", "Part Time"]) {
      expect(normalizeShareSchedule(stored)).toBe("Part-time");
    }
  });

  it("counts the retired types as part-time", () => {
    // These five were removed from every form, but profiles written before that
    // still hold them — and each one describes a partial week.
    for (const retired of [
      "After-school care",
      "Summer/Seasonal",
      "Weekend Nanny Share",
      "Pickup/Drop-off (Carpool style)",
      // "Flexible" was offered as a third care type by the caregiver
      // questionnaires, the match form and the nanny edit form. It is not a
      // schedule — it is the absence of one — and a member who chose it was
      // describing a week that is not full-time.
      "Flexible",
      "Other",
    ]) {
      expect(normalizeShareSchedule(retired)).toBe("Part-time");
    }
  });

  it("tells a blank answer apart from a part-time one", () => {
    // Null rather than "Part-time", so a card can say "not specified" instead
    // of inventing an answer the member never gave.
    for (const blank of ["", "   ", null, undefined]) {
      expect(normalizeShareSchedule(blank)).toBeNull();
    }
  });

  it("renders a blank answer as an empty label, never as a stray value", () => {
    expect(formatCareTypeLabel("summer/seasonal")).toBe("Part-time");
    expect(formatCareTypeLabel("")).toBe("");
  });
});
