import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Checkbox, ConfigProvider, Spin, TimePicker } from "antd";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight, Camera, Eye, Save, MapPin } from "lucide-react";
import CustomButton from "@shared/ui/Button";

/* Shared chrome for the two edit-profile pages (caregiver and family).
 *
 * The dashboard navbar is `sticky top-0 h-20 z-50` and the window is what
 * scrolls, so the action bar sticks at top-20 — directly under it — and the
 * section tabs stick under the action bar. A jump from a tab lands the
 * section heading just below the tabs instead of behind them. Change these
 * heights and the matching classes together. */
const NAVBAR_H = 80;
const ACTION_BAR_H = 68;
const TABS_H = 52;
const STICKY_STACK = NAVBAR_H + ACTION_BAR_H + TABS_H;

/* Field size, border and type come from the global form-field block in
 * index.css, like every other form. This only sets the accent: antd draws a
 * white tick on colorPrimary, and white on the periwinkle brand fill is
 * unreadable, so checkboxes and pickers use navy here. */
const accentTheme = { token: { colorPrimary: "#001243" } };

export function EditProfileLayout({
  title,
  subtitle,
  backTo,
  onDiscard,
  onSave,
  saving,
  viewProfileHref,
  identity,
  sections,
  children,
}) {
  const activeId = useActiveSection(sections.map((s) => s.id));
  const stripRef = useRef(null);
  const { canLeft, canRight } = useStripOverflow(stripRef);

  const scrollStrip = (dir) => {
    const strip = stripRef.current;
    if (strip) strip.scrollBy({ left: dir * strip.clientWidth * 0.7, behavior: "smooth" });
  };

  // Keep the active tab visible when the strip overflows (phones, long labels).
  // Scrolls only the strip, never the page, so it can't fight a jump in progress.
  useEffect(() => {
    const strip = stripRef.current;
    const tab = strip?.querySelector(`[data-tab="${activeId}"]`);
    if (!strip || !tab) return;
    const left = tab.offsetLeft - strip.clientWidth / 2 + tab.clientWidth / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [activeId]);

  const jumpTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - STICKY_STACK - 8;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <ConfigProvider theme={accentTheme}>
      <div className="-my-8 min-h-screen bg-[#F7F9FA] pb-24">
        {/* ── Sticky action bar ─────────────────────────────────────────── */}
        <div className="sticky top-20 z-40 bg-white/90 backdrop-blur-md border-b border-[#EEF0F4]">
          <div className="max-w-[1280px] mx-auto px-4 md:px-8 h-[68px] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Link
                to={backTo}
                aria-label="Back to dashboard"
                className="p-2 -ml-2 rounded-full hover:bg-[#EEF3FF] transition-colors shrink-0"
              >
                <ChevronLeft className="w-5 h-5 text-[#001243]" />
              </Link>
              <div className="min-w-0">
                <h1 className="Livvic-Bold text-lg md:text-xl text-[#001243] leading-tight truncate">{title}</h1>
                <p className="hidden sm:block Livvic-Medium text-xs text-gray-500 truncate">{subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <CustomButton
                onClick={onDiscard}
                disabled={saving}
                className="h-10 px-4 md:px-5 py-0 border border-[#E3E7EF] bg-white text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Discard
              </CustomButton>
              <CustomButton
                onClick={onSave}
                disabled={saving}
                className="h-10 px-4 md:px-6 py-0 bg-[#AEC4FF] hover:bg-[#C1D6FF] text-[#001243] text-sm disabled:opacity-60 flex items-center gap-2"
              >
                {saving ? <Spin size="small" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving…" : (
                  <>
                    <span className="sm:hidden Livvic-Medium">Save</span>
                    <span className="hidden sm:inline Livvic-Medium">Save changes</span>
                  </>
                )}
              </CustomButton>
            </div>
          </div>
        </div>

        <div className="max-w-[1280px] mx-auto px-4 md:px-8 pt-6 md:pt-8">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
            {/* ── Rail: who you are, and how others see you ────────────────── */}
            <aside
              className="w-full lg:w-[272px] lg:shrink-0 lg:sticky"
              style={{ top: NAVBAR_H + ACTION_BAR_H + 24 }}
            >
              <div className="bg-white rounded-[20px] border border-[#EEF0F4] p-5">
                {identity}

                <Link
                  to={viewProfileHref}
                  target="_blank"
                  rel="noopener"
                  className="mt-5 w-full h-11 rounded-full border border-[#AEC4FF] bg-[#EEF3FF] hover:bg-[#E2EAFF] text-[#001243] Livvic-SemiBold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Eye className="w-4 h-4" /> View profile
                </Link>
                <p className="Livvic-Medium text-xs text-gray-500 text-center mt-2">
                  Opens in a new tab and shows your last saved version.
                </p>
              </div>
            </aside>

            {/* ── Right half: section tabs, then the form as one sheet ────── */}
            <div className="w-full lg:flex-1 lg:min-w-0 bg-white rounded-[20px] border border-[#EEF0F4]">
              <nav
                aria-label="Profile sections"
                className="sticky z-30 bg-white/95 backdrop-blur-md rounded-t-[20px] border-b border-[#EEF0F4]"
                style={{ top: NAVBAR_H + ACTION_BAR_H }}
              >
                <div className="relative">
                {/* Swipe on touch; on a mouse the edge arrows (and the wheel)
                    reach tabs that don't fit. Fades mark the hidden side. */}
                <ul
                  ref={stripRef}
                  className="flex items-stretch gap-0.5 sm:gap-1 overflow-x-auto overscroll-x-contain hide-scrollbar px-2 sm:px-3 md:px-5 scroll-px-10"
                  style={{ height: TABS_H, WebkitOverflowScrolling: "touch" }}
                >
                  {sections.map((s) => {
                    const active = activeId === s.id;
                    return (
                      <li key={s.id} className="shrink-0 flex">
                        <button
                          type="button"
                          data-tab={s.id}
                          onClick={() => jumpTo(s.id)}
                          aria-current={active ? "true" : undefined}
                          className={`relative px-2.5 sm:px-3 bg-transparent border-none cursor-pointer text-[13px] sm:text-sm whitespace-nowrap transition-colors ${
                            active
                              ? "text-[#001243] Livvic-SemiBold"
                              : "text-gray-500 Livvic-Medium hover:text-[#001243]"
                          }`}
                        >
                          {s.label}
                          <span
                            aria-hidden="true"
                            className={`absolute left-2.5 right-2.5 sm:left-3 sm:right-3 bottom-0 h-[3px] rounded-t-full transition-colors ${
                              active ? "bg-[#AEC4FF]" : "bg-transparent"
                            }`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {[
                  { dir: -1, show: canLeft, side: "left-0 rounded-tl-[20px] bg-gradient-to-r pl-1.5 justify-start", Icon: ChevronLeft, label: "Earlier sections" },
                  { dir: 1, show: canRight, side: "right-0 rounded-tr-[20px] bg-gradient-to-l pr-1.5 justify-end", Icon: ChevronRight, label: "More sections" },
                ].map(({ dir, show, side, Icon, label }) => (
                  <div
                    key={dir}
                    className={`absolute inset-y-0 ${side} w-14 from-white via-white/90 to-transparent flex items-center transition-opacity duration-150 ${
                      show ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={label}
                      onClick={() => scrollStrip(dir)}
                      className="w-8 h-8 rounded-full bg-white border border-[#E3E7EF] shadow-sm flex items-center justify-center text-[#001243] hover:bg-[#EEF3FF] cursor-pointer"
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                </div>
              </nav>

              <div className="divide-y divide-[#EEF0F4]">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

/* One settings row: heading and hint on the left, fields on the right.
 * `stacked` puts the heading above the content, for things that need the
 * sheet's full width (the card preview, the weekly schedule). */
export function EditSection({ id, title, description, action, stacked = false, children }) {
  return (
    <section id={id} className="px-5 py-7 md:px-8 md:py-9">
      <div className={stacked ? "" : "grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-x-10 gap-y-5"}>
        <header className={`flex items-start justify-between gap-4 ${stacked ? "mb-5" : ""}`}>
          <div>
            <h2 className="Livvic-Bold text-[17px] text-[#001243] leading-snug">{title}</h2>
            {description && (
              <p className="Livvic-Medium text-[13px] leading-5 text-gray-500 mt-1 max-w-[46ch]">{description}</p>
            )}
          </div>
          {action}
        </header>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

/* Photo, name and area in the rail. The camera badge and the whole photo are
 * the same file input, so either is a target. */
export function ProfileIdentity({ image, name, location, onImageChange, hint }) {
  const initial = name?.charAt(0)?.toUpperCase() || "";
  return (
    <div className="flex lg:flex-col items-center gap-4 lg:gap-0 lg:text-center">
      <label className="relative shrink-0 cursor-pointer group" aria-label="Change profile photo">
        <input type="file" accept="image/*" className="sr-only" onChange={onImageChange} />
        {image ? (
          <img
            src={image}
            alt=""
            className="w-20 h-20 lg:w-32 lg:h-32 rounded-[20px] lg:rounded-[28px] object-cover"
          />
        ) : (
          <div className="w-20 h-20 lg:w-32 lg:h-32 rounded-[20px] lg:rounded-[28px] bg-[#AEC4FF] flex items-center justify-center text-[#001243] text-3xl lg:text-5xl Livvic-Bold">
            {initial}
          </div>
        )}
        <span className="absolute -bottom-1.5 -right-1.5 w-9 h-9 rounded-full bg-white border border-[#E3E7EF] shadow-sm flex items-center justify-center group-hover:bg-[#EEF3FF] transition-colors group-focus-within:ring-2 group-focus-within:ring-[#AEC4FF]">
          <Camera className="w-4 h-4 text-[#001243]" />
        </span>
      </label>

      <div className="min-w-0 lg:mt-4">
        <p className="Livvic-Bold text-lg text-[#001243] leading-tight truncate">{name || "Your name"}</p>
        {location && (
          <p className="Livvic-Medium text-sm text-gray-500 mt-1 flex items-center lg:justify-center gap-1 truncate">
            <MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{location}</span>
          </p>
        )}
        {hint && <p className="hidden lg:block Livvic-Medium text-xs text-gray-400 mt-3 leading-5">{hint}</p>}
      </div>
    </div>
  );
}

/* A label for a group that isn't a single Form.Item (chip pickers, rows). */
export function FieldLabel({ children, className = "" }) {
  return <p className={`Livvic-SemiBold text-sm text-[#4B5563] mb-3 ${className}`}>{children}</p>;
}

/* Pill toggle for the card preview's show/hide. */
export function PreviewToggle({ shown, onToggle }) {
  return (
    <CustomButton
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      className="shrink-0 h-8 px-3 rounded-full border border-[#E3E7EF] bg-white text-gray-600 Livvic-SemiBold text-xs hover:bg-gray-50 cursor-pointer py-0"
    >
      {shown ? "Hide" : "Show"}
    </CustomButton>
  );
}

/* Seven rows, one per day. A day that isn't ticked says so rather than
 * showing two disabled pickers, which read as broken inputs. `state` is the
 * pages' existing `{ [day]: { checked, start, end } }` shape, times as ISO. */
export function WeeklySchedule({ days, state, onToggle, onTimeChange }) {
  return (
    <ul className="flex flex-col divide-y divide-[#EEF0F4] border border-[#EEF0F4] rounded-2xl">
      {days.map((day) => {
        const d = state[day] || {};
        return (
          <li
            key={day}
            className={`grid grid-cols-1 sm:grid-cols-[150px_1fr] items-center gap-3 px-4 py-3 ${d.checked ? "bg-[#F8FAFF]" : ""}`}
          >
            <Checkbox checked={!!d.checked} onChange={() => onToggle(day)}>
              <span className={`Livvic-SemiBold text-sm ${d.checked ? "text-[#001243]" : "text-gray-500"}`}>{day}</span>
            </Checkbox>
            {d.checked ? (
              <div className="flex items-center gap-2">
                <TimePicker
                  value={d.start ? dayjs(d.start) : null}
                  placeholder="Start"
                  onChange={(t) => onTimeChange(day, "start", t)}
                  format="h:mm A"
                  use12Hours
                  minuteStep={15}
                  className="w-full sm:w-[140px]"
                  aria-label={`${day} start time`}
                />
                <span className="text-gray-400 text-sm Livvic-Medium">to</span>
                <TimePicker
                  value={d.end ? dayjs(d.end) : null}
                  placeholder="End"
                  onChange={(t) => onTimeChange(day, "end", t)}
                  format="h:mm A"
                  use12Hours
                  minuteStep={15}
                  className="w-full sm:w-[140px]"
                  aria-label={`${day} end time`}
                />
              </div>
            ) : (
              <span className="Livvic-Medium text-sm text-gray-400">Not available</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* Whether a horizontal strip has hidden content to either side. Re-measured
 * on scroll and on resize (rotation, the rail stacking on narrow screens).
 * Also turns a vertical wheel into a sideways scroll while the pointer is on
 * the strip — but only when the strip can actually move that way, so the page
 * keeps scrolling once the strip hits an end. */
function useStripOverflow(ref) {
  const [state, setState] = useState({ canLeft: false, canRight: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      setState({ canLeft: el.scrollLeft > 2, canRight: el.scrollLeft < max - 2 });
    };
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + e.deltaY;
      if (max <= 0 || (e.deltaY < 0 && el.scrollLeft <= 0) || (e.deltaY > 0 && el.scrollLeft >= max)) return;
      e.preventDefault();
      el.scrollLeft = Math.max(0, Math.min(max, next));
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      el.removeEventListener("wheel", onWheel);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);

  return state;
}

/* Which section is under the action bar right now. */
function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join("|");

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length || typeof IntersectionObserver === "undefined") return;

    const visible = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => visible.set(e.target.id, e.isIntersecting));
        const first = ids.find((id) => visible.get(id));
        if (first) setActive(first);
      },
      { rootMargin: `-${STICKY_STACK + 16}px 0px -55% 0px` }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return active;
}
