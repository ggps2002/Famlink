import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { MapPin, Lock, Users, Baby } from "lucide-react";
import { api } from "@shared/api/client";
import { loadGoogleMaps } from "@shared/lib/googleMaps";

import CustomButton from "@shared/ui/Button";
// Colors by dominant role. "parent" = families looking to share (leads);
// "nanny" = caregivers. Kept in sync with the legend below.
const AREA_STYLE = {
  parent: { fillColor: "#185FA5", label: "Families" },
  nanny: { fillColor: "#0F6E56", label: "Caregivers" },
};

// Distance in metres between two coordinates (equirectangular is plenty at
// city scale).
const metresBetween = ([aLat, aLng], [bLat, bLng]) => {
  const cos = Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  const dx = (bLng - aLng) * cos * (Math.PI / 180) * 6371000;
  const dy = (bLat - aLat) * (Math.PI / 180) * 6371000;
  return Math.hypot(dx, dy);
};

// Descending shares of a page's totals, one per circle: the busiest spot
// carries ~2.8x the quietest. Caregivers reuse the same weights reversed, so
// the quieter spots come out caregiver-dominant and the map isn't one flat
// colour.
const spreadWeights = (n) => {
  if (n === 1) return [1];
  const raw = Array.from({ length: n }, (_, i) => 1 + ((n - 1 - i) * 1.8) / (n - 1));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
};

// Split `total` across `weights` as whole members, largest fractional remainder
// first, so the parts add back up to exactly `total`.
const allocate = (total, weights) => {
  const exact = weights.map((w) => total * w);
  const parts = exact.map((v) => Math.floor(v));
  let left = total - parts.reduce((sum, n) => sum + n, 0);
  exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => {
      if (left > 0) {
        parts[i] += 1;
        left -= 1;
      }
    });
  return parts;
};

// The circles a configured page draws, one per hand-picked spot in cityGeo.
//
// The radius comes from the CLOSEST pair of spots, so no two circles can ever
// touch — one radius for all of them, because circles of visibly different
// sizes read as a data property we aren't actually encoding. The cap keeps the
// widest pages from drawing discs so large they swallow whole cities.
const buildCoverageAreas = ({ spots, families, caregivers }) => {
  const weights = spreadWeights(spots.length);
  const parents = allocate(families, weights);
  const nannies = allocate(caregivers, [...weights].reverse());

  let closest = Infinity;
  for (let i = 0; i < spots.length; i += 1) {
    for (let j = i + 1; j < spots.length; j += 1) {
      closest = Math.min(closest, metresBetween(spots[i], spots[j]));
    }
  }
  // 0.46 rather than a flat half, so neighbours keep a visible gap instead of
  // meeting exactly at a tangent.
  const radiusMeters = Math.round(Math.min(closest * 0.46, 2400));

  return spots
    .map(([lat, lng], i) => ({
      lat,
      lng,
      radiusMeters,
      parents: parents[i],
      nannies: nannies[i],
      total: parents[i] + nannies[i],
    }))
    // Densest last so they paint on top of the sparse ones, as the API does.
    .sort((a, b) => a.total - b.total);
};

// Category 4.1 — the coverage map embedded on the programmatic city /
// neighborhood pages. Rendered with the real Google Maps SDK, so it looks like
// Google Maps because it is Google Maps. (Pointing Leaflet at Google's tile
// endpoint would look the same and breach their terms; the SDK is the only
// legitimate route, and the app already loads it for Places autocomplete.)
//
// TWO SOURCES. Pages that carry a `coverage` block in cityGeo publish those
// configured numbers and a generated spread of circles — marketing owns what
// those launch pages show, and the API is not called at all. Every other page
// still renders whatever /location/map-pins actually reports.
//
// PRIVACY: either way there are no per-family markers here, and nothing on this
// map marks a point. The API returns grid areas with head counts, each drawn as
// a large translucent circle a couple of miles across, and it only draws one
// where several members share the area. A member could be anywhere underneath,
// and moving house within an area doesn't move the circle. The "conversion
// barrier" — real neighborhoods, contacting anyone, adding your own pin — stays
// behind registration, per the ops manual.
//
// WAITLIST MODE (`waitlist`, set from cityGeo on pre-launch markets): the same
// circles and counts, but every label calls them people who've joined the
// waitlist rather than members you can match with today, and the CTAs go to
// /waitlist instead of sign-up. Nothing about the geometry or the counts
// changes — only what we claim they are.
export default function NannyShareMap({ center, areaLabel, coverage, waitlist = false }) {
  const { lat, lng, zoom = 13 } = center || {};
  const radius = center?.radius || 8000;
  // A coverage block without spots can't be drawn, so it falls back to the API
  // rather than rendering counts with nothing under them.
  const configured = Boolean(coverage?.spots?.length);
  const { user } = useSelector((s) => s.auth);
  const isAuthed = user?.type === "Parents" || user?.type === "Nanny";
  const navigate = useNavigate();

  // Prefills the city on the waitlist form, the same way WaitlistUI links to it.
  const waitlistHref = `/waitlist?city=${encodeURIComponent(areaLabel || "")}`;

  const [areas, setAreas] = useState([]);
  const [counts, setCounts] = useState({ nannies: 0, parents: 0, total: 0 });
  // Smallest group the API will draw a circle for. Served alongside the data so
  // the copy stays true if the threshold is ever retuned server-side.
  const [minGroup, setMinGroup] = useState(3);
  const [loading, setLoading] = useState(true);
  // A failed request and a genuinely empty neighborhood are NOT the same thing.
  // Collapsing them told visitors "be the first here" whenever the API was
  // simply unreachable, which is both wrong and bad for conversion.
  const [failed, setFailed] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const containerRef = useRef(null);
  const mapsRef = useRef(null);
  const mapRef = useRef(null);
  const shapesRef = useRef([]);
  const infoWindowRef = useRef(null);
  const chipClassRef = useRef(null);

  // Coverage circles are a couple of miles wide, but cityGeo zooms the tightest
  // neighborhood pages to 14–15, where the viewport is only 1–2 km tall and a
  // single circle would fill the whole frame. Cap the opening zoom so several
  // areas and the surrounding streets are always in view.
  const openingZoom = Math.min(zoom, 12);

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    // Configured page: publish cityGeo's numbers and skip the request entirely.
    // `coverage` is the nested object off CITY_GEO, so its identity is stable
    // across renders even though resolveCityGeo() rebuilds the wrapper.
    if (configured) {
      setAreas(buildCoverageAreas(coverage));
      setCounts({
        parents: coverage.families,
        nannies: coverage.caregivers,
        total: coverage.families + coverage.caregivers,
        areas: coverage.areas,
      });
      setFailed(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get("/location/map-pins", {
          params: { lat, lng, radius },
        });
        if (cancelled) return;
        setAreas(Array.isArray(data?.areas) ? data.areas : []);
        setCounts(data?.counts || { nannies: 0, parents: 0, total: 0 });
        setMinGroup(Number(data?.minGroup) || 3);
        setFailed(false);
      } catch {
        if (!cancelled) {
          setAreas([]);
          setCounts({ nannies: 0, parents: 0, total: 0 });
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lat, lng, radius, configured, coverage]);

  // --- map instance -------------------------------------------------------
  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    let cancelled = false;

    loadGoogleMaps(import.meta.env.VITE_GOOGLE_KEY)
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;

        if (mapRef.current) {
          mapRef.current.setCenter({ lat, lng });
          mapRef.current.setZoom(openingZoom);
        } else {
          mapRef.current = new maps.Map(containerRef.current, {
            center: { lat, lng },
            zoom: openingZoom,
            minZoom: 9,
            // Hard stop on zooming in. Past ~z15 the basemap draws individual
            // buildings, which invites reading a circle as if it pointed at
            // one — and we hold no data that precise.
            maxZoom: 15,
            // Scroll gestures keep scrolling the page unless the visitor holds
            // ⌘/Ctrl, so the map never traps the page.
            gestureHandling: "cooperative",
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            // Google's own POI pins would read as if they were our members.
            clickableIcons: false,
          });
          infoWindowRef.current = new maps.InfoWindow();
        }
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, openingZoom]);

  // --- coverage circles ---------------------------------------------------
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!mapReady || !maps || !map) return undefined;

    // A chip carrying the head count. Deliberately an overlay rather than a
    // marker: it reports what the circle holds, it does not mark a spot.
    if (!chipClassRef.current) {
      chipClassRef.current = class CountChip extends maps.OverlayView {
        constructor(position, html) {
          super();
          this.position = position;
          this.html = html;
        }
        onAdd() {
          this.div = document.createElement("div");
          this.div.className = "famylink-area-chip-wrap";
          this.div.innerHTML = this.html;
          this.getPanes().floatPane.appendChild(this.div);
        }
        draw() {
          const point = this.getProjection()?.fromLatLngToDivPixel(this.position);
          if (!point || !this.div) return;
          this.div.style.left = `${point.x}px`;
          this.div.style.top = `${point.y}px`;
        }
        onRemove() {
          this.div?.remove();
          this.div = null;
        }
      };
    }
    const CountChip = chipClassRef.current;

    shapesRef.current.forEach((s) => s.setMap(null));
    shapesRef.current = [];

    areas.forEach((a) => {
      const dominant = a.nannies > a.parents ? "nanny" : "parent";
      const { fillColor } = AREA_STYLE[dominant];
      const drawRadius = a.radiusMeters || 2600;
      const position = new maps.LatLng(a.lat, a.lng);

      // Halo: a wider, barely-there wash under the main circle. Two stacked
      // translucent discs read as an edge that fades out, which is the honest
      // picture — there is no exact boundary here any more than there is an
      // exact point.
      //
      // Configured pages skip it. Their circles are sized to clear each other
      // exactly, and a halo 1.35x wider would put the wash from one spot over
      // its neighbour — overlap is overlap even when it's faint.
      if (!configured) {
        shapesRef.current.push(
          new maps.Circle({
            map,
            center: position,
            radius: drawRadius * 1.35,
            strokeWeight: 0,
            fillColor,
            fillOpacity: 0.05,
            clickable: false,
            zIndex: 1,
          })
        );
      }

      const circle = new maps.Circle({
        map,
        center: position,
        radius: drawRadius,
        strokeColor: fillColor,
        strokeOpacity: 0.4,
        strokeWeight: 1.5,
        fillColor,
        // Busier areas read darker, but the ceiling stays low: these circles
        // are wider than their grid areas and so overlap, and stacked fills
        // would otherwise turn the map underneath to mush.
        fillOpacity: Math.min(0.1 + a.total * 0.025, 0.24),
        zIndex: 2,
      });

      const miles = ((drawRadius * 2) / 1609).toFixed(1);
      circle.addListener("click", () => {
        const infoWindow = infoWindowRef.current;
        if (!infoWindow) return;
        infoWindow.setContent(
          `<div class="famylink-area-info">
             <strong>${a.total} ${
               waitlist ? "on the waitlist in this area" : "members in this area"
             }</strong>
             <span>${a.parents} ${a.parents === 1 ? "family" : "families"} ·
               ${a.nannies} ${a.nannies === 1 ? "caregiver" : "caregivers"}</span>
             <span>Somewhere in this ${miles}-mile circle — we never plot an
               address, and a circle is only drawn once at least ${minGroup}
               ${waitlist ? "people in the area have signed up" : "members share the area"}.</span>
             <a href="${
               waitlist ? waitlistHref : isAuthed ? "/dashboard" : "/joinNow"
             }" data-famylink-cta>
               ${
                 waitlist
                   ? "Join the waitlist →"
                   : isAuthed
                     ? "Browse matches →"
                     : "Sign up free to connect →"
               }
             </a>
           </div>`
        );
        infoWindow.setPosition(position);
        infoWindow.open(map);
      });
      shapesRef.current.push(circle);

      shapesRef.current.push(
        new CountChip(
          position,
          `<span class="famylink-area-chip">
             <span class="famylink-area-count">
               <i style="background:${AREA_STYLE.parent.fillColor}"></i>${a.parents}
             </span>
             <span class="famylink-area-count">
               <i style="background:${AREA_STYLE.nanny.fillColor}"></i>${a.nannies}
             </span>
           </span>`
        )
      );
      shapesRef.current.at(-1).setMap(map);
    });

    // Frame the generated spread rather than trusting the page's opening zoom:
    // cityGeo's radius varies 3–9 km, so a fixed zoom would leave the circles
    // huddled in the middle on the wide pages and spilling off the tight ones.
    // The API path keeps its opening zoom — those circles are where they are.
    if (configured && areas.length) {
      const bounds = new maps.LatLngBounds();
      areas.forEach((a) => {
        const circle = new maps.Circle({
          center: new maps.LatLng(a.lat, a.lng),
          radius: a.radiusMeters || 2600,
        });
        bounds.union(circle.getBounds());
      });
      map.fitBounds(bounds, 24);
    }

    return () => {
      shapesRef.current.forEach((s) => s.setMap(null));
      shapesRef.current = [];
    };
  }, [areas, mapReady, isAuthed, minGroup, configured, waitlist, waitlistHref]);

  // The info window is raw HTML, so its CTA is an <a>. Route it through the
  // router on click instead of letting it reload the whole app.
  useEffect(() => {
    const maps = mapsRef.current;
    const infoWindow = infoWindowRef.current;
    if (!mapReady || !maps || !infoWindow) return undefined;
    const listener = infoWindow.addListener("domready", () => {
      document.querySelectorAll("[data-famylink-cta]").forEach((el) => {
        el.onclick = (e) => {
          e.preventDefault();
          infoWindow.close();
          navigate(el.getAttribute("href"));
          window.scrollTo({ top: 0, behavior: "smooth" });
        };
      });
    });
    return () => listener.remove();
  }, [mapReady, navigate]);

  // The number of areas we SAY we cover. On configured pages that's the figure
  // from cityGeo, which is the count of neighborhoods served — deliberately not
  // the number of circles drawn, which is only ever a readable sample of them.
  // The API reports the two as the same number, so this is a no-op there.
  const areaCount = counts.areas ?? areas.length;
  const areaWord = useMemo(() => (areaCount === 1 ? "area" : "areas"), [areaCount]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return (
    <div className="w-full">
      <div className="relative isolate z-0 rounded-[20px] overflow-hidden border border-gray-200 shadow-sm">
        <div className="h-[380px] sm:h-[460px] w-full bg-[#E8EAED]">
          {mapError ? (
            <div className="h-full w-full flex items-center justify-center px-6 text-center">
              <p className="text-gray-500 text-sm">
                The map couldn&apos;t load right now. The coverage numbers below
                are still up to date.
              </p>
            </div>
          ) : (
            <div ref={containerRef} className="h-full w-full" />
          )}
        </div>

        {/* Counts card — overlaid top-right (top-left is Google's own control).
            Compact on phones so it doesn't swallow the small map: tighter
            inset/padding, a narrower max width, and the two counts stack. */}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-[5] bg-white/95 backdrop-blur rounded-lg sm:rounded-xl shadow-md px-3 py-2 sm:px-4 sm:py-3 max-w-[150px] sm:max-w-[220px]">
          <p className="Livvic-Bold text-[#001243] text-xs sm:text-sm leading-tight">
            {waitlist ? `Waitlist near ${areaLabel}` : `Nanny shares near ${areaLabel}`}
          </p>
          {loading ? (
            <p className="text-gray-400 text-xs mt-1">Loading the map…</p>
          ) : counts.total > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1.5 sm:mt-2">
              <span className="flex items-center gap-1.5 text-xs sm:text-[13px] text-gray-700 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: AREA_STYLE.parent.fillColor }} />
                {counts.parents} families
              </span>
              <span className="flex items-center gap-1.5 text-xs sm:text-[13px] text-gray-700 whitespace-nowrap">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: AREA_STYLE.nanny.fillColor }} />
                {counts.nannies} caregivers
              </span>
            </div>
          ) : null}
          {!loading && counts.total > 0 && areaCount > 0 && (
            <p className="text-gray-500 text-xs mt-2 leading-snug">
              {waitlist
                ? `waiting across ${areaCount} ${areaWord} nearby`
                : `across ${areaCount} ${areaWord} nearby`}
            </p>
          )}
          {!loading && failed && (
            <p className="text-gray-500 text-xs mt-1">
              Couldn&apos;t load coverage right now — please refresh.
            </p>
          )}
          {!loading && !failed && counts.total === 0 && (
            <p className="text-gray-500 text-xs mt-1">
              Be one of the first in {areaLabel} —{" "}
              {waitlist ? "join the waitlist below." : "add your pin below."}
            </p>
          )}
        </div>
      </div>

      {/* Conversion barrier — the gated actions live here. White so it reads as
          a card against the beige section it sits in. */}
      <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#AEC4FF] flex items-center justify-center shrink-0">
            <Lock size={18} className="text-[#001243]" />
          </div>
          <div>
            <p className="Livvic-Bold text-[#001243] text-base leading-snug">
              {waitlist
                ? `Join the waitlist to be first in ${areaLabel}`
                : isAuthed
                  ? "See who's in your area and connect"
                  : "Sign up free to see who's really near you"}
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mt-0.5">
              Each circle covers a whole neighborhood and holds at least{" "}
              {minGroup} families and caregivers
              {waitlist ? " who've joined the waitlist" : ""} — we never plot an
              individual address.{" "}
              {waitlist
                ? "Add your neighborhood and we'll let you know the moment nanny share matches open up near you."
                : isAuthed
                  ? "Browse matches to view details and message families and caregivers."
                  : "Create a free account to see who's a match, contact families, and add your own pin to the map."}
            </p>
          </div>
        </div>
        {/* Pre-launch markets get the single waitlist CTA — "sign up free" and
            "add your pin" both promise matching that isn't running here yet. */}
        <div className="flex gap-2 w-full sm:w-auto sm:shrink-0">
          {waitlist ? (
            <NavLink to={waitlistHref} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="w-full sm:w-auto">
              <CustomButton className="w-full sm:w-auto bg-[#AEC4FF] hover:bg-[#9BB8FF] text-[#001243] Livvic-SemiBold text-sm py-2.5 px-5 rounded-full transition-colors whitespace-nowrap">
                Join the waitlist
              </CustomButton>
            </NavLink>
          ) : isAuthed ? (
            <NavLink to="/dashboard" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="w-full sm:w-auto">
              <CustomButton className="w-full sm:w-auto bg-[#AEC4FF] hover:bg-[#9BB8FF] text-[#001243] Livvic-SemiBold text-sm py-2.5 px-5 rounded-full transition-colors whitespace-nowrap">
                Browse matches
              </CustomButton>
            </NavLink>
          ) : (
            <>
              <NavLink to="/find-nanny-share" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex-1 sm:flex-none">
                <CustomButton className="w-full sm:w-auto bg-white border border-gray-200 hover:border-gray-300 text-[#001243] Livvic-SemiBold text-sm py-2.5 px-4 sm:px-5 rounded-full transition-colors whitespace-nowrap">
                  Add your pin
                </CustomButton>
              </NavLink>
              <NavLink to="/joinNow" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex-1 sm:flex-none">
                <CustomButton className="w-full sm:w-auto bg-[#AEC4FF] hover:bg-[#9BB8FF] text-[#001243] Livvic-SemiBold text-sm py-2.5 px-4 sm:px-5 rounded-full transition-colors whitespace-nowrap">
                  Sign up free
                </CustomButton>
              </NavLink>
            </>
          )}
        </div>
      </div>

      {/* Legend + privacy note */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1.5">
          <Baby size={14} style={{ color: AREA_STYLE.parent.fillColor }} />{" "}
          {waitlist ? "Families on the waitlist" : "Families looking to share"}
        </span>
        <span className="flex items-center gap-1.5">
          <Users size={14} style={{ color: AREA_STYLE.nanny.fillColor }} />{" "}
          {waitlist ? "Caregivers on the waitlist" : "Caregivers available"}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={14} /> Each circle covers a neighborhood and holds{" "}
          {minGroup}+ {waitlist ? "signups" : "members"} — never anyone&apos;s
          address
        </span>
      </div>
    </div>
  );
}
