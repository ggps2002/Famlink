import Reviews from "@features/dashboard/components/Reviews";
import Ra from "@shared/ui/Rate";
import Prog from "@features/dashboard/components/progress";
import { NavLink } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Avatar from "react-avatar";
import { useEffect, useRef } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchFamilyByIdThunk } from "@features/dashboard/store/familyDataSlice";

export default function ProfileFamily() {
  const { id } = useParams();
  const navigate = useNavigate();
    const dispatch = useDispatch();

  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        try {
          await dispatch(fetchFamilyByIdThunk(id));
        } catch (error) {
          console.error("Error fetching family data:", error);
        }
      }
    };

    fetchData();
  }, [dispatch, id]);
  const { selectedFamily } = useSelector((s) => s.familyData);
  const scrollRef = useRef(null);
  const location = window.location.origin;
  //   const { data, isLoading } = useSelector((s) => s.jobPost);

  //   useEffect(() => {
  //     dispatch(fetchPostJobByCurrentUserThunk());
  //   }, [dispatch]);
  //   if (isLoading) {
  //     return <Loader />;
  //   }
  const ratingCount = selectedFamily?.reviews?.reduce((acc, review) => {
    const rating = Math.floor(review.rating);
    acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {});

  const totalReviews = selectedFamily?.reviews?.length || 0;

  const ratingPercentages = [5, 4, 3, 2, 1].map((num) => {
    const count = ratingCount?.[num] || 0;
    const pro = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
    return { num, pro };
  });

  const scrollAmount = 300; // adjust scroll distance as needed

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -scrollAmount, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  const formatLocation = () => {
    if (!selectedFamily?.zipCode || !selectedFamily?.location?.format_location) return "";
    const parts = selectedFamily?.location?.format_location.split(",") || [];
    const city = parts.at(-3)?.trim();
    const state = parts.at(-2)?.trim().split(" ")[0];
    return city && state ? `${city}, ${state}` : "";
  };
  return (
    <div className="flex flex-col lg:flex-row gap-4 md:gap-6 p-3 md:py-6 md:px-12  w-full justify-center">
      {/* Left Sidebar */}
      <div className="w-full lg:w-1/4 xl:w-1/3 2xl:w-1/4">
        {/* Profile Card */}
        <div className="shadow-soft p-4 md:p-6 lg:p-9 rounded-[20px]">
          <div className="flex flex-col items-center">
            {selectedFamily?.imageUrl ? (
              <img
                className="mx-auto rounded-[16px] w-20 md:w-24 object-contain"
                src={selectedFamily?.imageUrl}
                alt="img"
              />
            ) : (
              <Avatar
                className="rounded-[16px] text-black"
                size="96"
                color={"#AEC4FF"}
                name={selectedFamily?.name
                  ?.split(" ") // Split by space
                  .slice(0, 2) // Take first 1–2 words
                  .join(" ")}
              />
            )}

            <div className="flex gap-2">
              <p className="my-2 text-primary Livvic-SemiBold text-xl md:text-2xl text-center">
                {selectedFamily?.name}
              </p>
            </div>
            {selectedFamily?.location?.format_location && (
              <p className="text-[#555555] text-center text-sm md:text-md Livvic-Medium">
                {formatLocation()}
              </p>
            )}
            <div className="mt-4 md:mt-6 w-full">
              {/* <NavLink
                to="/family/edit"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                {" "}
                <CustomButton
                  btnText={"Edit Profile"}
                  className="bg-primary w-full py-2 text-sm md:text-base"
                />
              </NavLink> */}
              <div className="relative w-full">
                {/* <CustomButton
                  btnText={
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                      <Link className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5 text-[#555555]" />
                      <span
                        className="text-[
#555555] Livvic-Medium text-sm md:text-base"
                      >
                        Copy Profile Link
                      </span>
                    </div>
                  }
                  className="w-full py-2 sm:py-2.5 md:py-3 mt-2 border border-gray-200 text-[#555555] Livvic-Medium text-xs sm:text-sm md:text-base lg:text-lg"
                /> */}
              </div>
              {/* <div className="bg-yellow-100 rounded-full px-4 py-1 w-fit mx-auto mt-2 flex gap-2 items-center">
                <Info className="text-yellow-400" size={20} />
                <p className="text-yellow-400">working on copy feature</p>
              </div> */}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full lg:w-2/3 xl:w-2/3 2xl:w-1/2 space-y-4 md:space-y-6">
        {/* About Me Section */}
        <div className="shadow-soft p-4 md:p-6 rounded-[20px]">
          <p className="Livvic-SemiBold text-base md:text-lg text-primary">
            About Me
          </p>
          <p className="Livvic text-sm md:text-md text-[#555555] mt-2">
            {selectedFamily?.aboutMe}
          </p>
          <hr className="my-4" />
          <p className="Livvic-SemiBold text-base md:text-lg text-primary">
            Number of Child
          </p>
          <ul className="mt-2 space-y-2 Livvic-SemiBold text-[#555555] text-lg">
            {selectedFamily?.noOfChildren?.length + " children"}
          </ul>
          <hr className="my-4" />
          <p className="Livvic-SemiBold text-base md:text-lg text-primary">
            Age of Children
          </p>
          <ul className="mt-2 space-y-2">
            {selectedFamily?.noOfChildren?.info &&
              Object.entries(selectedFamily?.noOfChildren?.info).map(([key, value], i) => (
                <li key={i} className="Livvic-SemiBold text-[#555555] text-lg">
                  {value} years old
                </li>
              ))}
          </ul>
        </div>

        {/* Reviews Section */}
        <div className="shadow-soft p-4 md:p-6 rounded-[20px]">
          <p className="Livvic-SemiBold text-base md:text-lg text-primary">
            Reviews
          </p>
          {selectedFamily?.reviews && selectedFamily?.reviews.length > 0 ? (
            <div className="mt-4">
              <div className="flex flex-col items-center md:flex-row justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="space-y-2 text-center sm:text-left">
                    <p className="Livvic-Bold text-3xl md:text-4xl">
                      {selectedFamily?.averageRating}
                    </p>
                    <Ra points={selectedFamily?.averageRating} size={20} />
                    <p className="Livvic-SemiBold text-sm">
                      {selectedFamily?.reviews.length} Reviews
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {ratingPercentages.map(({ num, pro }, i) => (
                      <Prog key={i} num={num} pro={pro} color={"#029E76"} />
                    ))}
                  </div>
                </div>
                <div className="flex self-center md:self-end gap-2 md:gap-4 justify-center">
                  <div
                    onClick={scrollLeft}
                    className="p-2 rounded-full border border-[#EEEEEE] cursor-pointer hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4 md:w-6 md:h-6" />
                  </div>
                  <div
                    onClick={scrollRight}
                    className="p-2 rounded-full border border-[#EEEEEE] cursor-pointer hover:bg-gray-50"
                  >
                    <ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
                  </div>
                </div>
              </div>
              <div className="flex justify-center md:justify-start">
                <div
                  ref={scrollRef}
                  className="mt-6 md:mt-10 flex flex-nowrap gap-3 md:gap-4 overflow-x-hidden scroll-smooth snap-x snap-mandatory overflow-y-hidden"
                >
                  {selectedFamily?.reviews?.map((v, i) => (
                    <Reviews
                      key={i}
                      size={13.5}
                      points={v?.rating}
                      para={v?.msg}
                      name={v?.userId?.name}
                      img={v?.userId?.imageUrl}
                      hr={i !== selectedFamily?.reviews.length - 1}
                      created={v?.createdAt} // Only add <hr> if it's not the last item
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm md:text-base">No reviews available</p>
          )}
        </div>
      </div>
    </div>
  );
}
