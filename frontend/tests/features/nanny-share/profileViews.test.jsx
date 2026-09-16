import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * The two nanny-share profile screens, rebuilt onto the shared profile layout.
 *
 * What is pinned here is what the rebuild could quietly break: the sidebar
 * still renders the identity and the match CTA, the existing grouped detail
 * sections survive, and the review panel offers a review on exactly the same
 * rule as the caregiver profile — an ACCEPTED match and nothing less.
 */

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "member-1" }),
  useNavigate: () => navigate,
}));

const thunk = (type) => vi.fn((arg) => ({ type, arg }));

vi.mock("@features/dashboard/store/nannyDataSlice", () => ({
  fetchNannyByIdThunk: thunk("nanny/getById"),
}));
vi.mock("@features/dashboard/store/favouriteSlice", () => ({
  addOrRemoveFavouriteThunk: thunk("favourite/toggle"),
}));
vi.mock("@features/auth/store/authSlice", () => ({ refreshTokenThunk: thunk("auth/refresh") }));
vi.mock("@features/nanny-share/store/nannyShareSlice", () => ({
  viewCurrentUserProfileThunk: thunk("share/currentProfile"),
}));
vi.mock("@features/referral/store/referralSlice", () => ({
  getMyReferralThunk: thunk("referral/mine"),
}));
vi.mock("@features/matching/store/matchSlice", () => ({
  getMatchWithUserThunk: thunk("match/withUser"),
}));
vi.mock("@features/dashboard/store/reviewSlice", () => ({
  submitReviewThunk: thunk("review/submit"),
}));
vi.mock("@shared/ui/toast", () => ({ fireToastMessage: vi.fn() }));

// The gating modals are their own screens; they are stubbed so this file tests
// the profile layout rather than their contents.
vi.mock("@features/matching/components/CompleteProfileModal", () => ({
  CompleteProfileModal: () => null,
}));
vi.mock("@features/matching/components/MatchRequestFormModal", () => ({
  MatchRequestFormModal: () => null,
}));
vi.mock("@features/matching/components/RequestMatchDenied", () => ({
  RequestMatchDenied: () => null,
}));
vi.mock("@features/referral/components/ReferAFriendModal", () => ({
  ReferAFriendModal: () => null,
}));

/**
 * A "Label: value" line. The label sits in its own span, so the text is split
 * across nodes and a plain string matcher cannot see the whole line.
 */
const line = (pattern) => (_content, element) =>
  element?.tagName === "P" && pattern.test(element.textContent.replace(/\s+/g, " ").trim());

let state;
let matchPayload;

const dispatch = vi.fn((action) => ({
  unwrap: () => {
    if (action?.type === "match/withUser") return Promise.resolve(matchPayload);
    return Promise.resolve({ status: 200, data: { message: "ok" } });
  },
}));

vi.mock("react-redux", () => ({
  useDispatch: () => dispatch,
  useSelector: (selector) => selector(state),
}));

const { default: FamilyProfileView } = await import(
  "@features/nanny-share/profile-views/FamilyProfileView"
);
const { default: NannyProfileView } = await import(
  "@features/nanny-share/profile-views/NannyProfileView"
);

const aFamily = (over = {}) => ({
  _id: "member-1",
  name: "dana whitfield",
  aboutMe: "We are a family of four in Oakland.",
  imageUrl: null,
  location: { format_location: "1 Main St, Oakland, CA 94601, USA" },
  averageRating: "4.5",
  reviews: [],
  additionalInfo: [],
  nannyProfile: {
    hasNanny: false,
    numberOfChildren: 2,
    childrenAges: [{ label: "3 years" }, { label: "5 years" }],
    hourlyBudget: { minShare: 10, maxShare: 12 },
    nannyShareType: "Full-time",
    flexibility: "Very flexible",
  },
  ...over,
});

const aNanny = (over = {}) => ({
  _id: "member-1",
  name: "sheena fernandes",
  imageUrl: null,
  location: { format_location: "1 Main St, Oakland, CA 94601, USA" },
  averageRating: "5.0",
  reviews: [],
  additionalInfo: [{ key: "jobDescription", value: "Six years with infants." }],
  nannyProfile: {
    hasFamily: false,
    careExperience: "3-5 years",
    sharedRate: "20",
    rateType: "hourly",
    backgroundCheck: "Yes",
    hasTransport: "Yes",
  },
  ...over,
});

const baseState = (selectedNanny) => ({
  nannyData: { selectedNanny, isLoading: false, error: null },
  auth: { user: { _id: "viewer-1", favourite: [], nannyProfileCompleted: true }, accessToken: "t" },
  postNannyShare: { currentProfile: null },
});

beforeEach(() => {
  matchPayload = { data: null };
});

describe("FamilyProfileView", () => {
  beforeEach(() => { state = baseState(aFamily()); });

  it("puts the identity and the match CTA on the sidebar card", () => {
    render(<FamilyProfileView />);

    expect(screen.getByText("Dana W.")).toBeInTheDocument();
    expect(screen.getByText("Oakland, CA")).toBeInTheDocument();
    expect(screen.getByText("Request a Match")).toBeInTheDocument();
    // The back affordance was removed from every profile/detail screen.
    expect(screen.queryByText("Back to Search")).not.toBeInTheDocument();
  });

  it("shows the children and budget tiles from the stored profile", () => {
    render(<FamilyProfileView />);

    expect(screen.getAllByText("Children").length).toBe(2);
    // getAllByText throughout: the sidebar summarises values the detail rows
    // below spell out again, which is the point of the summary.
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    // The tile carries the number, not "~$10 - $12/hr per family". It also
    // appears in the Budget box, so both are matched.
    expect(screen.getAllByText("$10 - $12/hr").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Children").length).toBe(2);
  });

  it("renders the answers in the design's boxes rather than icon rows", () => {
    render(<FamilyProfileView />);

    // The five box kinds the Figma page has: a paragraph, a ✔ list, a bulleted
    // list, a day/time schedule and label⟷price rows.
    expect(screen.getByText("About Dana W.")).toBeInTheDocument();
    expect(screen.getByText("Care Needs")).toBeInTheDocument();
    expect(screen.getAllByText("Children").length).toBe(2);
    // The sidebar tile is labelled "Our share" and the box "Budget" — a family
    // states one rate, their own, so neither needs to distinguish it from a
    // second one.
    expect(screen.getAllByText("Budget").length).toBe(1);
    expect(screen.getByText("Our share")).toBeInTheDocument();
    expect(screen.getByText("Each family")).toBeInTheDocument();
    // A family has no standalone caregiver rate anywhere on their profile: the
    // combined figure stored beside their answer is the caregiver's, not theirs.
    expect(screen.queryByText("Total rate")).not.toBeInTheDocument();
    expect(screen.queryByText("On their own")).not.toBeInTheDocument();
    // Facts read as "Label: value" on one line, not pushed to opposite edges.
    expect(screen.getByText(line(/^Share type: Full-time$/))).toBeInTheDocument();
    expect(screen.getByText(line(/^How many: 2 Children$/))).toBeInTheDocument();
    expect(screen.getByText(line(/^Ages: 3 years, 5 years$/))).toBeInTheDocument();
  });

  it("shows the week as day-over-time, the way the design does", () => {
    state = baseState(
      aFamily({
        nannyProfile: {
          ...aFamily().nannyProfile,
          specificDays: {
            Monday: { checked: true, start: "2026-01-05T17:30:00.000Z", end: "2026-01-05T23:00:00.000Z" },
            Tuesday: { checked: false },
          },
        },
      }),
    );
    render(<FamilyProfileView />);

    expect(screen.getByText("Weekly Schedule")).toBeInTheDocument();
    expect(screen.getByText("Monday")).toBeInTheDocument();
    expect(screen.getByText(/^\d{1,2}:\d{2} (AM|PM) - \d{1,2}:\d{2} (AM|PM)$/)).toBeInTheDocument();
    // Unchecked days are left out entirely.
    expect(screen.queryByText("Tuesday")).not.toBeInTheDocument();
  });

  it("lists only the at-a-glance facts they answered", () => {
    render(<FamilyProfileView />);

    // Also appears in the Care Needs box, so both are matched.
    expect(screen.getAllByText(/✔\s+Looking for a nanny$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/✔\s+Schedule: Very flexible$/)).toBeInTheDocument();
    // Urgency and communication were left blank, so they are not listed as
    // "not specified".
    expect(screen.queryByText(/not specified/i)).not.toBeInTheDocument();
  });

  it("offers a review only once the match is accepted", async () => {
    render(<FamilyProfileView />);
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(screen.queryByText("Leave a review")).not.toBeInTheDocument();
  });

  it("offers a review on an accepted match", async () => {
    matchPayload = { data: { status: "accepted" } };
    render(<FamilyProfileView />);

    await waitFor(() => expect(screen.getByText("Leave a review")).toBeInTheDocument());
  });

  it("withdraws the offer once this viewer has reviewed", async () => {
    matchPayload = { data: { status: "accepted" } };
    state = baseState(
      aFamily({
        reviews: [{ _id: "r1", rating: 5, msg: "Lovely", userId: { _id: "viewer-1", name: "Me" } }],
      }),
    );
    render(<FamilyProfileView />);

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(screen.queryByText("Leave a review")).not.toBeInTheDocument();
    // The panel itself still renders their existing review.
    expect(screen.getByText("Lovely")).toBeInTheDocument();
  });
});

describe("NannyProfileView", () => {
  beforeEach(() => { state = baseState(aNanny()); });

  it("puts the identity, tiles and match CTA on the sidebar card", () => {
    render(<NannyProfileView />);

    expect(screen.getByText("Sheena F.")).toBeInTheDocument();
    expect(screen.getByText("Work Experience")).toBeInTheDocument();
    expect(screen.getAllByText("3-5 years").length).toBeGreaterThan(0);
    // `sharedRate: "20"` is the caregiver's COMBINED rate for both families, so
    // the tile shows one family's half of it — the number a reader is deciding
    // on, and the one that makes the comparison with a solo rate mean anything.
    expect(screen.getAllByText("$10/hr").length).toBeGreaterThan(0);
    expect(screen.queryByText("$20/hr")).not.toBeInTheDocument();
    expect(screen.getByText("Request a Match")).toBeInTheDocument();
  });

  it("renders the answers in the design's boxes rather than icon rows", () => {
    render(<NannyProfileView />);

    expect(screen.getByText("About Sheena")).toBeInTheDocument();
    expect(screen.getByText("Credentials")).toBeInTheDocument();
    expect(screen.getByText("Experience")).toBeInTheDocument();
    // Labelled rows, matching the family view and the design.
    expect(screen.getByText(line(/^Years of experience: 3-5 years$/))).toBeInTheDocument();
    expect(screen.getByText("Rates")).toBeInTheDocument();
    expect(screen.getByText(/✔\s+Background checked$/)).toBeInTheDocument();
    expect(screen.getByText(/✔\s+Has transportation$/)).toBeInTheDocument();
  });

  it("lists the compatibility facts at a glance", () => {
    render(<NannyProfileView />);

    expect(screen.getByText(/✔\s+Has Transportation$/)).toBeInTheDocument();
    expect(screen.getByText(/✔\s+Background Checked$/)).toBeInTheDocument();
  });

  it("offers a review only on an accepted match", async () => {
    matchPayload = { data: { status: "rejected" } };
    const { unmount } = render(<NannyProfileView />);
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(screen.queryByText("Leave a review")).not.toBeInTheDocument();
    unmount();

    matchPayload = { data: { status: "accepted" } };
    render(<NannyProfileView />);
    await waitFor(() => expect(screen.getByText("Leave a review")).toBeInTheDocument());
  });
});
