/**
 * The anonymisation grid behind the public coverage map.
 *
 * Pure geometry, deliberately separated from the query and the HTTP layer, so
 * the properties below are assertable rather than merely asserted in a comment.
 * Nothing here touches the database or the request.
 *
 * The map publishes NO per-person points. Members are snapped to cells of a
 * fixed global grid, and only a cell centre, a display radius, and a head count
 * ever leave the server. Three properties hold, each closing a specific attack:
 *
 *   1. THE GRID IS FIXED AND GLOBAL, anchored at (0, 0) — never at the query
 *      centre. Panning or re-centring cannot shift the grid to triangulate a
 *      finer position, and moving house inside a cell changes nothing in the
 *      response, so averaging many requests reveals nothing.
 *   2. EVERY PUBLISHED CIRCLE COVERS AT LEAST `MIN_GROUP` MEMBERS. A cell that
 *      would expose fewer merges into the next grid up, and if it is still
 *      short it is not drawn at all. A circle never stands for one identifiable
 *      household.
 *   3. MEMBERSHIP USES THE CELL CENTRE's distance to the query point, never the
 *      member's real distance. Otherwise an attacker could sweep the `radius`
 *      parameter, watch for the moment a circle appears, binary-search a
 *      member's exact distance from a chosen centre, and trilaterate. Testing
 *      the cell caps that attack at cell resolution.
 */

const M_PER_DEG_LAT = 111320;

/**
 * Base grid cell height in degrees of latitude. 0.03° ≈ 3.3 km, so the smallest
 * cell we will ever publish covers ~11 km² — a ~2-mile square. That is a
 * district, not a street: knowing someone's cell gives you nowhere to turn up.
 */
export const BASE_LAT_DEG = 0.03;
export const BASE_SIDE_M = BASE_LAT_DEG * M_PER_DEG_LAT; // ~3340 m
export const BASE_HALF_DIAGONAL_M = (BASE_SIDE_M * Math.SQRT2) / 2; // ~2361 m

/**
 * Grid levels as multiples of the base cell: ~3.3 km, then ~6.7 km. Sparse
 * cells roll up until the group is big enough to publish. Each step is a
 * power-of-two multiple anchored at 0, so a fine cell always nests exactly
 * inside a coarse one.
 */
export const LEVEL_MULTIPLIERS = [1, 2];
export const COARSEST_LAT_DEG = BASE_LAT_DEG * LEVEL_MULTIPLIERS.at(-1);

/**
 * Smallest number of members a drawn circle may represent. Below this the cell
 * merges upward; if even the coarsest falls short the group is counted in the
 * headline totals but never drawn.
 */
export const MIN_GROUP = 3;

/**
 * The drawn circle is 10% wider than the cell's half-diagonal, so it is a
 * strict superset of the area the count could have come from ("somewhere in
 * this circle" is literally true) and neighbouring circles overlap instead of
 * tiling — the blobs never resolve into a crisp grid a viewer could read
 * boundaries off.
 */
const DRAW_OVERSHOOT = 1.1;

/**
 * Longitude degrees shrink as you leave the equator. Deriving the correction
 * from the COARSEST band — not each level's own band — is what keeps the levels
 * nested: every cell sharing a coarse parent shares its correction.
 */
const bandCos = (realLat) => {
  const bandIdx = Math.floor(realLat / COARSEST_LAT_DEG);
  const bandLat = (bandIdx + 0.5) * COARSEST_LAT_DEG;
  return Math.max(Math.cos((bandLat * Math.PI) / 180), 0.05);
};

/** Snap a real coordinate to the centre of its cell at the given level. */
export const cellFor = (realLat, realLng, mult) => {
  const latStep = BASE_LAT_DEG * mult;
  const lngStep = latStep / bandCos(realLat);
  const latIdx = Math.floor(realLat / latStep);
  const lngIdx = Math.floor(realLng / lngStep);
  const sideM = latStep * M_PER_DEG_LAT;
  const halfDiagonalM = (sideM * Math.SQRT2) / 2;

  return {
    lat: (latIdx + 0.5) * latStep,
    lng: (lngIdx + 0.5) * lngStep,
    sideM,
    halfDiagonalM,
    radiusMeters: Math.round(halfDiagonalM * DRAW_OVERSHOOT),
    key: `${mult}:${latIdx}:${lngIdx}`,
  };
};

/** Metres between two points; equirectangular is plenty at city scale. */
export const distanceM = (aLat, aLng, bLat, bLng) => {
  const cos = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const dx = (bLng - aLng) * cos * (Math.PI / 180) * 6371000;
  const dy = (bLat - aLat) * (Math.PI / 180) * 6371000;
  return Math.hypot(dx, dy);
};

/** Bucket members into cells at one level. */
export const groupByCell = (members, mult) => {
  const groups = new Map();

  for (const member of members) {
    const cell = cellFor(member.lat, member.lng, mult);
    let group = groups.get(cell.key);

    if (!group) {
      group = { cell, members: [], nannies: 0, parents: 0 };
      groups.set(cell.key, group);
    }

    group.members.push(member);
    if (member.type === "nanny") group.nannies += 1;
    else group.parents += 1;
  }

  return groups;
};

/** Roll sparse cells up the levels until each group clears MIN_GROUP. */
export const buildGroups = (members) => {
  const groups = [];
  let pending = members;

  for (const mult of LEVEL_MULTIPLIERS) {
    if (pending.length === 0) break;

    const isLastLevel = mult === LEVEL_MULTIPLIERS.at(-1);
    const carry = [];

    for (const group of groupByCell(pending, mult).values()) {
      const total = group.nannies + group.parents;

      if (total >= MIN_GROUP) {
        groups.push({ ...group, total, drawn: true });
      } else if (isLastLevel) {
        // Too few even at the coarsest grid: counted, never drawn.
        groups.push({ ...group, total, drawn: false });
      } else {
        carry.push(...group.members);
      }
    }

    pending = carry;
  }

  return groups;
};

/**
 * Turn grouped members into the published response for one query.
 *
 * The overlap test is on the CELL — property 3 above. Overlap rather than
 * centre-inside matters because the tightest neighborhood pages ask for a
 * 2.5 km radius, smaller than a cell: a centre-inside test would hand them an
 * empty map with members standing right there.
 *
 * The margin is always the BASE cell's half-diagonal, never the (possibly
 * merged) cell's own. Letting a 6.7 km merged cell claim a 4.7 km margin made
 * every East Bay neighborhood page report the same head count, because they all
 * scooped up the same handful of coarse cells.
 */
export const summariseAreas = (groups, { lat, lng, radius }) => {
  const reach = radius + BASE_HALF_DIAGONAL_M;

  let nannies = 0;
  let parents = 0;
  let hidden = 0;
  const areas = [];

  for (const group of groups) {
    if (distanceM(lat, lng, group.cell.lat, group.cell.lng) > reach) continue;

    nannies += group.nannies;
    parents += group.parents;

    if (!group.drawn) {
      hidden += group.total;
      continue;
    }

    areas.push({
      lat: Number(group.cell.lat.toFixed(4)),
      lng: Number(group.cell.lng.toFixed(4)),
      radiusMeters: group.cell.radiusMeters,
      nannies: group.nannies,
      parents: group.parents,
      total: group.total,
    });
  }

  // Densest areas last so they paint on top of the sparse ones.
  areas.sort((a, b) => a.total - b.total);

  return {
    counts: {
      nannies,
      parents,
      total: nannies + parents,
      areas: areas.length,
      // In range but below MIN_GROUP anywhere on the grid: in the headline
      // numbers, with no circle of their own.
      hidden,
    },
    areas,
  };
};
