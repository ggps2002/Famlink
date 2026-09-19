import { useRef } from "react";
import { HeartOutlined, HeartFilled } from "@ant-design/icons";
import Ra from "@shared/ui/Rate";
import Prog from "@features/dashboard/components/progress";
import Reviews from "@features/dashboard/components/Reviews";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import Avatar from "react-avatar";
import {
  customFormat,
  formatSentence,
  formatTime,
} from "@shared/lib/toCamelCase";
import { addOrRemoveFavouriteThunk } from "@features/dashboard/store/favouriteSlice";
import { refreshTokenThunk } from "@features/auth/store/authSlice";
import { fireToastMessage } from "@shared/ui/toast";
import { fetchFamilyByIdThunk } from "@features/dashboard/store/familyDataSlice";
import { createChatThunk } from "@features/chat/store/chatSlice";
import { fetchPostJobByIdThunk } from "@features/jobs/store/postJobSlice";
import Loader from "@shared/ui/Loader";
import { formatCreatedAt, formatTimeRange } from "@shared/lib/dates";
import { findMatchingRate1 } from "@shared/lib/rates";
import { Button } from "antd";
import { getSubscriptionStatusThunk } from "@features/subscription/store/cardSlice";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
} from "lucide-react";
import CustomButton from "@shared/ui/Button";

function formatJobTitle(jobType) {
  if (!jobType) return "Job Needed";

  const withSpaces = jobType.replace(/([a-z])([A-Z])/g, "$1 $2");
  const capitalized = withSpaces
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return `${capitalized} Needed`;
}

export default function ProfileNanny() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const nannyShare = pathname.split("/")[1] === "family";
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useSelector((state) => state.jobPost);
  const { user, accessToken } = useSelector((state) => state.auth);
  const [isFavorited, setIsFavorited] = useState(user.favourite?.includes(id));
  const subscription = useSelector(
    (state) => state.cardData.subscriptionStatus,
  );
  const isSubscribed = subscription?.active;

  const ratingCount = data?.user?.reviews?.reduce((acc, review) => {
    const rating = Math.floor(review.rating);
    acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {});

  const totalReviews = data?.user?.reviews?.length || 0;

  // Helper function to format location
  const formatLocation = () => {
    if (!data?.user?.zipCode || !data?.user?.location) return "";
    const parts = data?.user?.location.format_location.split(",") || [];
    const city = parts.at(-3)?.trim();
    const state = parts.at(-2)?.trim().split(" ")[0];
    return city && state ? `${city}, ${state}` : "";
  };

  const ratingPercentages = [5, 4, 3, 2, 1].map((num) => {
    const count = ratingCount?.[num] || 0;
    const pro = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
    return { num, pro };
  });

  useEffect(() => {
    dispatch(fetchPostJobByIdThunk(id));
    dispatch(getSubscriptionStatusThunk());
  }, [dispatch, id]);

  const favourite = () => {
    dispatch(addOrRemoveFavouriteThunk({ favouriteUserId: id, accessToken }));
    dispatch(refreshTokenThunk());
    setIsFavorited((prev) => !prev);
  };


  const scrollRef = useRef(null);
  const scrollAmount = 300; // adjust scroll distance as needed

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -scrollAmount, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  const handleMessage = async () => {
    try {
      const participants = [user?._id, data?.user?._id];
      const { status } = await dispatch(
        createChatThunk({ participants }),
      ).unwrap();
      if (status === 201 || status === 200) {
        navigate(nannyShare ? `/family/message/` : `/nanny/message/`);
      }
    } catch (error) {
      fireToastMessage({ type: "error", message: error.message });
    }
  };

  if (isLoading) return <Loader />;

  return (
    <div className="relative padding-navbar1 w-full flex flex-col justify-between min-h-screen">
      {/* {!isSubscribed ? (
        <>
          <div className="absolute inset-0 z-10 backdrop-blur-sm bg-white/50 w-full h-full min-h-full" />
          <div className="absolute z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-8 py-6 rounded-xl shadow-soft text-center w-[400px]">
            <p className="text-2xl Livvic-SemiBold text-primary mb-2 whitespace-break-spaces">
              Upgrade to see profiles that matches with you
            </p>
            <p className="mb-4 text-primary Livvic-Medium text-sm">
              Unlock full details and messaging
            </p>
            <CustomButton
              btnText={"Upgrade Now"}
              action={() => navigate("/dashboard/setting?option=Subscription")}
              className="bg-[#D6FB9A] text-[#025747] Livvic-SemiBold text-sm"
            />
          </div>
        </>
      ) : ( */}
      <div className="w-full flex flex-col items-center space-y-4 py-2">
        {/* Head */}
        <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px] space-y-2">
          <div className="flex justify-between items-center">
            <h1 className="Livvic-SemiBold text-2xl text-primary">
              {formatJobTitle(data?.jobType)}
            </h1>
            <div className="flex gap-2">
              <div className="py-2 px-4 rounded-full bg-[#ECF1FF] Livvic-SemiBold text-sm">
                {data?.[data?.jobType]?.preferredSchedule}
              </div>
              <div
                onClick={favourite}
                className="flex justify-end items-center gap-x-1 text-red-600 cursor-pointer"
              >
                {" "}
                {isFavorited ? (
                  <HeartFilled className="text-tertiary" />
                ) : (
                  <Heart className="text-tertiary" height={20} width={20} />
                )}
              </div>
            </div>
          </div>
          <p className="Livvic-Medium items-center text-sm text-[#555555] flex gap-4">
            <MapPin className="w-5 h-5" />{" "}
            {formatLocation(data?.user?.location)}
          </p>
          <p className="Livvic-Medium items-center text-sm text-[#555555] flex gap-4">
            <img src="/care-person.svg" alt="nanny" />{" "}
            {data?.user?.noOfChildren?.length} kids (
            {data?.user?.noOfChildren?.info &&
              Object.entries(data.user.noOfChildren.info)
                .map(([child, age]) => age && `${age} yrs old`)
                .filter(Boolean)
                .join(", ")}
            )
          </p>
          <p className="Livvic-Medium items-center text-sm text-[#555555] flex gap-4">
            <Calendar className="w-5 h-5" /> {formatCreatedAt(data?.createdAt)}
          </p>
          <p className="Livvic-Medium items-center text-sm text-[#222222] flex gap-4">
            {data?.user?.imageUrl ? (
              <img
                className="bg-black rounded-full w-6 h-6 object-cover"
                src={data?.user?.imageUrl}
                alt="img"
              />
            ) : (
              <Avatar
                className="rounded-full text-black"
                size="24"
                color={"#AEC4FF"}
                name={data?.user?.name
                  ?.split(" ") // Split by space
                  .slice(0, 2) // Take first 1–2 words
                  .join(" ")}
              />
            )}
            <NavLink
              to={`/nanny/profileFamily/${data?.user?._id}`}
              className="text-primary hover:underline"
            >
              {data?.user?.name}
            </NavLink>
          </p>
        </div>
        <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px] space-y-2">
          <h1 className="Livvic-SemiBold text-2xl text-primary mb-2">
            Children Information
          </h1>
          {data?.user?.noOfChildren?.info &&
            Object.entries(data.user.noOfChildren.info).map(
              ([child, age], index) => (
                <div key={index}>•{age ? ` ${age} yrs old` : ""}</div>
              ),
            )}
        </div>
        <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px] space-y-2">
          <h1 className="Livvic-SemiBold text-2xl text-primary mb-4">
            Expectations
          </h1>
          <div className="text-sm text-gray-700 space-y-2">
            {data?.[data?.jobType]?.expectationsCaregiver &&
              Object.entries(data[data.jobType].expectationsCaregiver).map(
                ([activity, specify], idx) => (
                  <p key={idx} className="text-[#555555] Livvic-Medium">
                    •{" "}
                    {activity
                      .replace(/([A-Z])/g, " $1") // insert space before capital letters
                      .replace(/^./, (c) => c.toUpperCase())}
                    <span className="text-[#555555] Livvic-SemiBold">
                      {specify ? `: ${specify}` : ""}
                    </span>
                  </p>
                ),
              )}
          </div>
        </div>
        <div className="shadow-soft p-6 w-full lg:w-1/2 rounded-[20px] space-y-2">
          <h1 className="Livvic-SemiBold text-2xl text-primary mb-4">
            Schedule
          </h1>
          {data?.[data?.jobType]?.specificDays &&
            Object.entries(data[data.jobType]?.specificDays).map(
              ([day, time], idx) => (
                <>
                  <p key={idx} className="text-[#555555] Livvic-SemiBold">
                    • {day}
                  </p>
                  <p className="text-[#666666] Livvic-Medium">
                    {formatTimeRange(time.start, time.end)}
                  </p>
                </>
              ),
            )}
        </div>
        <div className="shadow-soft p-3 sm:p-4 md:p-6 rounded-[20px] w-full max-w-full lg:w-1/2">
          <p className="Livvic-SemiBold text-base md:text-lg text-primary">
            Reviews
          </p>
          {data?.user?.reviews && data?.user?.reviews.length > 0 ? (
            <div className="mt-4">
              <div className="flex flex-col items-center lg:flex-row lg:justify-between gap-4 lg:gap-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center sm:items-start">
                  <div className="space-y-2 text-center sm:text-left">
                    <p className="Livvic-Bold text-2xl sm:text-3xl md:text-4xl">
                      {data?.user?.averageRating}
                    </p>
                    <Ra points={data?.user?.averageRating} size={20} />
                    <p className="Livvic-SemiBold text-sm">
                      {totalReviews} Reviews
                    </p>
                  </div>
                  <div className="flex-shrink-0 w-full sm:w-auto">
                    {ratingPercentages.map(({ num, pro }, i) => (
                      <Prog key={i} num={num} pro={pro} color={"#029E76"} />
                    ))}
                  </div>
                </div>
                <div className="flex self-center lg:self-end gap-2 md:gap-4 justify-center">
                  <div
                    onClick={scrollLeft}
                    className="p-2 rounded-full border border-[#EEEEEE] cursor-pointer hover:bg-gray-50 touch-manipulation"
                  >
                    <ChevronLeft className="w-4 h-4 md:w-6 md:h-6" />
                  </div>
                  <div
                    onClick={scrollRight}
                    className="p-2 rounded-full border border-[#EEEEEE] cursor-pointer hover:bg-gray-50 touch-manipulation"
                  >
                    <ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
                  </div>
                </div>
              </div>
              <div className="flex justify-center lg:justify-start">
                <div
                  ref={scrollRef}
                  className="mt-6 md:mt-10 flex flex-nowrap gap-2 sm:gap-3 md:gap-4 overflow-x-auto lg:overflow-x-hidden scroll-smooth snap-x snap-mandatory overflow-y-hidden w-full"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "#CBD5E0 transparent",
                  }}
                >
                  {data?.user?.reviews?.map((v, i) => (
                    <Reviews
                      key={i}
                      size={8}
                      points={v?.rating}
                      para={v?.msg}
                      name={v?.reviewer?.name}
                      img={v?.reviewer?.imageUrl}
                      hr={i !== data?.user?.reviews.length - 1} // Only add <hr> if it's not the last item
                      created={v?.createdAt}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm md:text-base">No reviews available</p>
          )}
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
          <CustomButton
            btnText={"Message"}
            action={() => handleMessage()}
            className="border border-[#EEEEEE] text-[#555555]"
          />
        </div>
        {data?.hired && (
          <NavLink
            to={"/nanny"}
            className={
              "text-green-800  over:-translate-y-1 duration-700 delay-150 hover:opacity-60"
            }
          >
            Candidates already hired
          </NavLink>
        )}
      </div>
      {/* )}*/}
    </div>
  );
}
