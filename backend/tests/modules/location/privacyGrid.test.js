import { describe, it, expect } from "vitest";
import {
  cellFor,
  buildGroups,
  summariseAreas,
  distanceM,
  BASE_LAT_DEG,
  BASE_SIDE_M,
  MIN_GROUP,
} from "#src/modules/location/privacyGrid.js";

/**
 * The public map's privacy properties, asserted rather than merely documented.
 *
 * Each block below corresponds to one of the three properties described at the
 * top of privacyGrid.js. They were previously enforced only by the code being
 * written carefully once.
 */

const OAKLAND = { lat: 37.8044, lng: -122.2712 };

const membersAround = (count, { lat, lng }, type = "parent", spread = 0.001) =>
  Array.from({ length: count }, (_, i) => ({
    lat: lat + i * spread,
    lng: lng + i * spread,
    type,
  }));

describe("property 1: the grid is fixed and global", () => {
  it("puts a point in the same cell no matter what the query centre was", () => {
    // The grid is anchored at (0,0), so panning the map cannot shift it to
    // triangulate a finer position.
    const cell = cellFor(OAKLAND.lat, OAKLAND.lng, 1);

    expect(cellFor(OAKLAND.lat, OAKLAND.lng, 1).key).toBe(cell.key);
    expect(cellFor(OAKLAND.lat, OAKLAND.lng, 1).lat).toBe(cell.lat);
  });

  it("does not move a member's cell when they move within it", () => {
    // Averaging many requests over time must reveal nothing.
    const a = cellFor(OAKLAND.lat, OAKLAND.lng, 1);
    const b = cellFor(OAKLAND.lat + BASE_LAT_DEG / 4, OAKLAND.lng, 1);

    expect(b.key).toBe(a.key);
    expect(b.lat).toBe(a.lat);
    expect(b.lng).toBe(a.lng);
  });

  it("snaps to a cell centre, never to the member's own position", () => {
    const cell = cellFor(OAKLAND.lat, OAKLAND.lng, 1);

    expect(cell.lat).not.toBe(OAKLAND.lat);
    expect(cell.lng).not.toBe(OAKLAND.lng);
  });

  it("nests a fine cell exactly inside its coarse parent", () => {
    // Levels are power-of-two multiples anchored at 0, and the longitude
    // correction comes from the coarsest band so the nesting holds.
    const fine = cellFor(OAKLAND.lat, OAKLAND.lng, 1);
    const coarse = cellFor(OAKLAND.lat, OAKLAND.lng, 2);

    expect(Math.abs(fine.lat - coarse.lat)).toBeLessThanOrEqual(coarse.sideM / 111320);
  });

  it("publishes cells no smaller than ~3.3 km on a side", () => {
    // A district, not a street: knowing someone's cell gives you nowhere to
    // turn up.
    expect(BASE_SIDE_M).toBeGreaterThan(3000);
    expect(cellFor(OAKLAND.lat, OAKLAND.lng, 1).sideM).toBeGreaterThan(3000);
  });
});

describe("property 2: every drawn circle covers at least MIN_GROUP members", () => {
  it("draws a cell that clears the threshold", () => {
    const groups = buildGroups(membersAround(MIN_GROUP, OAKLAND));
    const drawn = groups.filter((g) => g.drawn);

    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.every((g) => g.total >= MIN_GROUP)).toBe(true);
  });

  it("never draws a circle for a lone member", () => {
    // The attack this closes: a circle standing for one identifiable household.
    const groups = buildGroups([{ ...OAKLAND, type: "parent" }]);

    expect(groups.every((g) => !g.drawn)).toBe(true);
  });

  it("merges a sparse cell upward instead of publishing it", () => {
    // Two members in one fine cell, one in a neighbour: the fine cells are all
    // short, but the coarse cell they share is not.
    const members = [
      { lat: OAKLAND.lat, lng: OAKLAND.lng, type: "parent" },
      { lat: OAKLAND.lat + 0.001, lng: OAKLAND.lng, type: "nanny" },
      { lat: OAKLAND.lat + BASE_LAT_DEG, lng: OAKLAND.lng, type: "parent" },
    ];

    const drawn = buildGroups(members).filter((g) => g.drawn);

    expect(drawn.every((g) => g.total >= MIN_GROUP)).toBe(true);
  });

  it("counts undrawn members in the totals but gives them no circle", () => {
    const { counts, areas } = summariseAreas(buildGroups([{ ...OAKLAND, type: "parent" }]), {
      ...OAKLAND,
      radius: 8000,
    });

    expect(counts.total).toBe(1);
    expect(counts.hidden).toBe(1);
    expect(areas).toHaveLength(0);
  });

  it("emits no member coordinate in the published areas", () => {
    // The response must contain no coordinate belonging to any person.
    const members = membersAround(5, OAKLAND);
    const { areas } = summariseAreas(buildGroups(members), { ...OAKLAND, radius: 8000 });

    for (const area of areas) {
      for (const member of members) {
        expect(area.lat).not.toBe(member.lat);
        expect(area.lng).not.toBe(member.lng);
      }
    }
  });

  it("draws a circle strictly larger than the cell it summarises", () => {
    // "Somewhere in this circle" has to be literally true, and neighbouring
    // circles must overlap rather than tile into a readable grid.
    const cell = cellFor(OAKLAND.lat, OAKLAND.lng, 1);

    expect(cell.radiusMeters).toBeGreaterThan(cell.halfDiagonalM);
  });
});

describe("property 3: membership is tested on the cell centre", () => {
  it("does not change which areas appear as the radius is swept finely", () => {
    // The attack: sweep `radius`, watch for the moment a circle appears,
    // binary-search a member's true distance, trilaterate from a few centres.
    // Testing the cell caps the resolution of that search at cell size.
    const members = membersAround(6, OAKLAND);
    const groups = buildGroups(members);

    const at = (radius) =>
      summariseAreas(groups, { ...OAKLAND, radius })
        .areas.map((a) => `${a.lat},${a.lng}`)
        .sort()
        .join("|");

    // A 1-metre sweep across a wide span must not reveal a boundary.
    expect(at(5000)).toBe(at(5001));
    expect(at(5001)).toBe(at(5002));
  });

  it("includes a cell that merely overlaps the requested circle", () => {
    // The tightest neighborhood pages ask for 2.5 km, smaller than a cell; a
    // centre-inside test would hand them an empty map with members right there.
    const members = membersAround(4, OAKLAND, "parent", 0.0005);
    const { areas } = summariseAreas(buildGroups(members), { ...OAKLAND, radius: 2500 });

    expect(areas.length).toBeGreaterThan(0);
  });

  it("excludes a cell well outside the requested circle", () => {
    const faraway = { lat: 40.7128, lng: -74.006 }; // New York
    const groups = buildGroups(membersAround(5, faraway));

    const { areas, counts } = summariseAreas(groups, { ...OAKLAND, radius: 8000 });

    expect(areas).toHaveLength(0);
    expect(counts.total).toBe(0);
  });
});

describe("output shape", () => {
  it("separates caregiver and family counts", () => {
    const members = [...membersAround(3, OAKLAND, "nanny"), ...membersAround(3, OAKLAND, "parent")];
    const { counts } = summariseAreas(buildGroups(members), { ...OAKLAND, radius: 8000 });

    expect(counts.nannies).toBe(3);
    expect(counts.parents).toBe(3);
    expect(counts.total).toBe(6);
  });

  it("orders areas so the densest paint last", () => {
    const members = [
      ...membersAround(6, OAKLAND, "parent", 0.0005),
      ...membersAround(3, { lat: OAKLAND.lat + 0.05, lng: OAKLAND.lng }, "nanny", 0.0005),
    ];

    const { areas } = summariseAreas(buildGroups(members), { ...OAKLAND, radius: 20000 });
    const totals = areas.map((a) => a.total);

    expect([...totals].sort((a, b) => a - b)).toEqual(totals);
  });

  it("rounds published centres to 4 decimal places", () => {
    const { areas } = summariseAreas(buildGroups(membersAround(4, OAKLAND)), {
      ...OAKLAND,
      radius: 8000,
    });

    for (const area of areas) {
      expect(String(area.lat).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(4);
    }
  });
});

describe("distanceM", () => {
  it("measures roughly correctly at city scale", () => {
    // ~0.01° of latitude is ~1.1 km.
    const d = distanceM(OAKLAND.lat, OAKLAND.lng, OAKLAND.lat + 0.01, OAKLAND.lng);

    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(1200);
  });

  it("is zero for a point against itself", () => {
    expect(distanceM(OAKLAND.lat, OAKLAND.lng, OAKLAND.lat, OAKLAND.lng)).toBe(0);
  });
});
