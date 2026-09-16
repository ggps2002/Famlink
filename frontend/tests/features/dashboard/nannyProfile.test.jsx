import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

/**
 * The caregiver profile screen, and specifically the one rule that decides
 * whether it offers a review: an ACCEPTED match with the viewer.
 *
 * Redux and the router are mocked rather than assembled. This page reads two
 * slices and six thunks, and standing the real store up would test the store.
 * What is worth pinning is that the page reads the loose `additionalInfo`
 * pairs correctly and that the review button appears exactly when it should.
 */

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "nanny-1" }),
  useNavigate: () => navigate,
}));

const thunk = (type) => vi.fn((arg) => ({ type, arg }));

const fetchNannyByIdThunk = thunk("nanny/getById");
const getMatchWithUserThunk = thunk("match/withUser");
const submitReviewThunk = thunk("review/submit");
const createChatThunk = thunk("chat/create");

vi.mock("@features/dashboard/store/nannyDataSlice", () => ({
  fetchNannyByIdThunk: (...a) => fetchNannyByIdThunk(...a),
}));
vi.mock("@features/matching/store/matchSlice", () => ({
  getMatchWithUserThunk: (...a) => getMatchWithUserThunk(...a),
}));
vi.mock("@features/dashboard/store/reviewSlice", () => ({
  submitReviewThunk: (...a) => submitReviewThunk(...a),
}));
vi.mock("@features/chat/store/chatSlice", () => ({
  createChatThunk: (...a) => createChatThunk(...a),
}));
vi.mock("@features/dashboard/store/favouriteSlice", () => ({
  addOrRemoveFavouriteThunk: thunk("favourite/toggle"),
}));
vi.mock("@features/auth/store/authSlice", () => ({
  refreshTokenThunk: thunk("auth/refresh"),
}));
vi.mock("@shared/ui/toast", () => ({ fireToastMessage: vi.fn() }));

let state;
let matchPayload;

const dispatch = vi.fn((action) => ({
  unwrap: () => {
    if (action?.type === "match/withUser") return Promise.resolve(matchPayload);
    if (action?.type === "review/submit") return Promise.resolve({ data: { message: "ok" } });
    return Promise.resolve({ status: 200 });
  },
}));

vi.mock("react-redux", () => ({
  useDispatch: () => dispatch,
  useSelector: (selector) => selector(state),
}));

const { default: ProfileNanny } = await import("@features/dashboard/pages/NannyProfile");

const aNanny = (over = {}) => ({
  _id: "nanny-1",
  name: "sheena fernandes",
  imageUrl: null,
  zipCode: "11101",
  location: { format_location: "1 Main St, Long Island City, NY 11101, USA" },
  verified: { phoneVer: true, nationalIDVer: "true" },
  averageRating: "5.0",
  reviews: [],
  additionalInfo: [
    { key: "jobDescription", value: "I have plenty of child care experience." },
    { key: "experience", value: { option: "Over 5 years" } },
    { key: "language", value: { option: ["english", "spanish"] } },
    { key: "ageGroupsExp", value: { option: ["Infants (0-1)", "Toddlers (1-3)"] } },
    { key: "interestedPosi", value: { option: ["nanny", "babysitter"] } },
    { key: "certification", value: { option: ["Yes, I have first aid and CPR certifications."] } },
    { key: "salaryRange", value: { min: 20 } },
    { key: "salaryExp", value: { firstChild: 25, secChild: 28 } },
    {
      key: "specificDaysAndTime",
      value: {
        Monday: { checked: true, start: "2026-01-05T16:30:00.000Z", end: "2026-01-05T22:00:00.000Z" },
        Tuesday: { checked: false },
      },
    },
  ],
  ...over,
});

beforeEach(() => {
  matchPayload = { data: null };
  state = {
    nannyData: { selectedNanny: aNanny() },
    auth: { user: { _id: "viewer-1", favourite: [] } },
  };
});

describe("caregiver profile", () => {
  it("shortens the surname and addresses the message button by first name", () => {
    render(<ProfileNanny />);

    expect(screen.getByText("Sheena F.")).toBeInTheDocument();
    expect(screen.getByText("Message Sheena")).toBeInTheDocument();
  });

  it("renders the sections the design calls for, from the stored answers", () => {
    render(<ProfileNanny />);

    expect(screen.getByText("About Sheena")).toBeInTheDocument();
    expect(screen.getByText("Credentials")).toBeInTheDocument();
    expect(screen.getByText("Work Experience - Over 5 years")).toBeInTheDocument();
    expect(screen.getByText("Weekly Schedule")).toBeInTheDocument();
    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByText("Verifications")).toBeInTheDocument();
    expect(screen.getByText("English, Spanish")).toBeInTheDocument();
    expect(screen.getByText("Long Island City, NY")).toBeInTheDocument();
  });

  it("builds credentials from the roles and the certification answer", () => {
    render(<ProfileNanny />);

    // Rendered with the design's "✔" prefix, so matched by content.
    expect(screen.getByText(/✔\s+Nanny$/)).toBeInTheDocument();
    expect(screen.getByText(/✔\s+Babysitter$/)).toBeInTheDocument();
    expect(screen.getByText(/✔\s+First Aid$/)).toBeInTheDocument();
    expect(screen.getByText(/✔\s+CPR$/)).toBeInTheDocument();
  });

  it("prices only the per-child rates that were answered", () => {
    render(<ProfileNanny />);

    expect(screen.getByText("$25/h")).toBeInTheDocument();
    expect(screen.getByText("$28/h")).toBeInTheDocument();
    // 3, 4 and 5+ were left blank, so they are not invented as $undefined.
    expect(screen.queryByText("3 Child")).not.toBeInTheDocument();
  });

  it("checks only the verifications backed by a stored flag", () => {
    render(<ProfileNanny />);

    // phoneVer and nationalIDVer are set; Passport and Driving License have no
    // field behind them and must not claim a tick.
    expect(screen.getAllByAltText("Verified")).toHaveLength(3);
    expect(screen.getByText("Passport")).toBeInTheDocument();
  });
});

describe('caregiver profile "Leave a review"', () => {
  it("is hidden when the two have never matched", async () => {
    render(<ProfileNanny />);

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(screen.queryByText("Leave a review")).not.toBeInTheDocument();
  });

  it("is hidden while the match request is only pending", async () => {
    matchPayload = { data: { status: "pending" } };
    render(<ProfileNanny />);

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(screen.queryByText("Leave a review")).not.toBeInTheDocument();
  });

  it("is offered once the match is accepted", async () => {
    matchPayload = { data: { status: "accepted" } };
    render(<ProfileNanny />);

    await waitFor(() => expect(screen.getByText("Leave a review")).toBeInTheDocument());
  });

  it("is withdrawn after this viewer has already left one", async () => {
    matchPayload = { data: { status: "accepted" } };
    state.nannyData.selectedNanny = aNanny({
      reviews: [{ _id: "r1", rating: 5, msg: "Great", userId: { _id: "viewer-1", name: "Me" } }],
    });
    render(<ProfileNanny />);

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(screen.queryByText("Leave a review")).not.toBeInTheDocument();
  });

  it("still offers one when the viewer's only review was for a booking", async () => {
    // Booking reviews are per-job; the profile review is a separate, single one.
    matchPayload = { data: { status: "accepted" } };
    state.nannyData.selectedNanny = aNanny({
      reviews: [
        { _id: "r1", rating: 5, msg: "Great", bookingId: "b1", userId: { _id: "viewer-1", name: "Me" } },
      ],
    });
    render(<ProfileNanny />);

    await waitFor(() => expect(screen.getByText("Leave a review")).toBeInTheDocument());
  });

  it("is never offered on your own profile", async () => {
    matchPayload = { data: { status: "accepted" } };
    state.auth.user = { _id: "nanny-1", favourite: [] };
    render(<ProfileNanny />);

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(screen.queryByText("Leave a review")).not.toBeInTheDocument();
    // …and there is nobody to message, either.
    expect(screen.queryByText("Message Sheena")).not.toBeInTheDocument();
  });
});
