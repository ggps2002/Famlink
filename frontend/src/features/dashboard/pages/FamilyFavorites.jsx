import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { Pagination } from "antd";
import { NavLink } from "react-router-dom";
import Avatar from "react-avatar";
import { Heart, Star } from "lucide-react";
import { ProfileCard1 } from "@features/nanny-share/components/profileCard";
import { fetchFavoritesThunk } from "@features/dashboard/store/favouriteSlice";
import { useFavourite } from "@features/dashboard/useFavourite";
import Ra from "@shared/ui/Rate";
import Loader from "@shared/ui/Loader";

// First name + last initial, matching the browse cards. A favourite is not
// necessarily a match, so the same pre-match privacy treatment applies here.
const formatName = (name) => {
  if (!name) return "";
  const [first = "", last] = name.trim().split(" ");
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
};

// Short, human location from the public location object — which carries an area
// and never a point (see the backend's publicLocation).
const formatLocation = (location) => {
  if (!location) return "";
  if (location.neighborhood) return location.neighborhood;
  if (location.city) return location.city;
  if (location.format_location) {
    return (
      location.format_location.split(",").slice(-3, -1).join(", ") ||
      location.format_location
    );
  }
  return "";
};

/* ─── A saved member ───────────────────────────────────────────────────────
   The whole row opens their profile; the heart unsaves without navigating.
   Which of the two profile screens it opens is decided by who they are, and
   both are keyed by user id — which is exactly what the favourites list holds
   for a member row. */
function FavouriteMember({ profile }) {
  const { isFavorited, toggleFavourite } = useFavourite(profile._id);

  const isFamily = profile.type === "Parents";
  const name = formatName(profile.name);
  const location = formatLocation(profile.location);
  const path = isFamily
    ? `/dashboard/family-profile-view/${profile._id}`
    : `/dashboard/nanny-profile-view/${profile._id}`;

  return (
    <NavLink
      to={path}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-[#AEC4FF] transition-colors"
    >
      <div className="w-14 h-14 shrink-0">
        {profile.imageUrl ? (
          <img
            src={profile.imageUrl}
            alt={name}
            className="w-14 h-14 rounded-full object-cover"
          />
        ) : (
          <Avatar
            name={profile.name}
            size="56"
            color="#C8D8FF"
            fgColor="#001243"
            className="Livvic-Bold rounded-full"
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="Livvic-Bold text-base text-[#0D134C] truncate">{name}</p>
        <p className="Livvic-Medium text-sm text-gray-400 truncate">
          {isFamily ? "Family" : "Nanny"}
          {location && <span> • {location}</span>}
        </p>
        {/* Rendered only once someone has actually reviewed them — an empty row
            of grey stars claims a rating of zero, which is a worse thing to say
            about a new member than saying nothing. */}
        {profile.totalRatings > 0 && (
          <span className="flex items-center gap-1 mt-1">
            <Ra points={profile.averageRating} size={13} />
            <span className="Livvic-SemiBold text-[#555555] text-xs">
              {profile.averageRating}
              <span className="text-[#9AA5B1]"> ({profile.totalRatings})</span>
            </span>
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={toggleFavourite}
        aria-label={isFavorited ? "Remove from favourites" : "Add to favourites"}
        className="shrink-0 p-2 rounded-full hover:bg-gray-50 transition-colors"
      >
        <Heart
          size={20}
          className={isFavorited ? "text-red-500 fill-red-500" : "text-[#0D134C]"}
        />
      </button>
    </NavLink>
  );
}

/* ─── Favourites ───────────────────────────────────────────────────────────
   One page for both roles. It used to be two, and the caregiver one was never
   routed — so a caregiver got the family page, which rendered every row as a
   member and linked to routes the app no longer has. Rows now say which kind
   they are (see the favourite service) and are rendered accordingly. */
export default function Favorites() {
  const { isLoading, data, pagination } = useSelector(
    (state) => state.favouriteData
  );
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // `user.favourite.length` is in the deps on purpose: unsaving a row from this
  // page changes it, and the list has to be re-read or the row stays on screen
  // with an empty heart until a manual refresh.
  useEffect(() => {
    dispatch(fetchFavoritesThunk({ page: currentPage, limit: pageSize }));
  }, [dispatch, currentPage, user?.favourite?.length]);

  const total = pagination ? pagination.totalRecords : 0;

  // Unsaving the last row on a page would otherwise strand the reader on an
  // empty page with a pager that no longer reaches it.
  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    if (currentPage > lastPage) setCurrentPage(lastPage);
  }, [total, currentPage]);

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  if (isLoading) return <Loader />;

  return (
    <div className="padding-navbar1 Quicksand min-h-screen max-w-5xl mx-auto">
      <p className="Livvic-SemiBold lg:text-3xl text-2xl mb-8">Favorites</p>

      {data.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.map((row) =>
            row.kind === "job" ? (
              <ProfileCard1
                key={row._id}
                id={row._id}
                fav
                img={row.user?.imageUrl}
                name={row.user?.name}
                intro={row?.[row?.jobType]?.jobDescription || "N/A"}
                loc={row.user?.location}
                zipCode={row.user?.zipCode}
                hr={row.user?.noOfChildren?.length}
                rate={row.user?.averageRating}
                time={row?.[row?.jobType]?.preferredSchedule}
                jobType={row?.jobType}
                created={row?.createdAt}
                nanny
              />
            ) : (
              <FavouriteMember key={row._id} profile={row} />
            )
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-10">
          <div className="w-12 h-12 rounded-2xl bg-[#EBF0FF] flex items-center justify-center mb-4">
            <Star size={22} color="#0D134C" />
          </div>
          <p className="Livvic-Bold text-2xl text-[#0D134C] mb-2">
            Nothing saved yet.
          </p>
          <p className="Livvic text-base text-gray-400 max-w-md leading-relaxed mb-6">
            Tap the heart on any profile or job post and it will be waiting for
            you here.
          </p>
          <NavLink to="/dashboard">
            <button className="bg-[#AEC4FF] hover:bg-[#9db4f7] text-[#0D134C] Livvic-Bold px-5 py-2.5 rounded-xl text-sm transition-colors">
              Find a Match →
            </button>
          </NavLink>
        </div>
      )}

      {total > pageSize && (
        <div className="flex justify-end mt-6">
          <p
            style={{ color: "#667085" }}
            className="mt-1 mr-4 Livvic-Medium text-sm Quicksand"
          >
            Showing {startItem}-{endItem} from {total}
          </p>
          <Pagination
            className="Livvic-Bold"
            current={currentPage}
            pageSize={pageSize}
            total={total}
            onChange={setCurrentPage}
            showSizeChanger={false}
          />
        </div>
      )}
    </div>
  );
}
