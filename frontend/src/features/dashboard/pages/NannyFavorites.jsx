import { useDispatch, useSelector } from "react-redux";
import ProfileCard, { ProfileCard1 } from "@features/nanny-share/components/profileCard";
import { fetchFavoritesThunk } from "@features/dashboard/store/favouriteSlice";
import { useEffect, useState } from "react";
import { Pagination } from "antd";
import { NavLink } from "react-router-dom";
import FavouriteCard from "@features/dashboard/components/FavoriteCard";
import Loader from "@shared/ui/Loader";

export default function Favorites({ nanny }) {
  const { isLoading, data, pagination } = useSelector(
    (state) => state.favouriteData
  );
  const { user, accessToken } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 4; // Set your desired limit per page
  const fetchFavorites = async (page) => {
    const limit = pageSize;

    const dat = await dispatch(fetchFavoritesThunk({ page, limit })).unwrap();
  };

  useEffect(() => {
    fetchFavorites(currentPage); // Fetch favorites when the component mounts or current page changes
  }, [currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page); // Update the current page
  };

  // Calculate the range of items being shown
  const total = pagination ? pagination.totalRecords : 0; // Total number of records
  const startItem = (currentPage - 1) * pageSize + 1; // Start item index
  const endItem = Math.min(currentPage * pageSize, total); // End item index
  if (isLoading) {
    return <Loader />; // You can customize this loading message or spinner
  }
  return (
    <div className="padding-navbar1 min-h-screen max-w-7xl mx-auto">
      <p className="Livvic-SemiBold text-3xl mb-6">Favorite</p>
      <div className="flex max-lg:flex-col gap-6">
        {data.length > 0 ? (
          data.map((v) => {
            return (
              <NavLink
                key={v._id}
                to={`/nanny/jobDescription/${v._id}`}
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <ProfileCard1
                  id={v._id}
                  img={v.user.imageUrl}
                  name={v.user.name}
                  intro={v?.[v?.jobType]?.jobDescription || "N/A"}
                  loc={v?.user.location}
                  hr={v?.user?.noOfChildren?.length}
                  rate={v?.user?.averageRating}
                  time={v?.[v?.jobType]?.preferredSchedule}
                  nanny={true}
                  jobType={v?.jobType}
                  fav={true}
                />
              </NavLink>
            );
          })
        ) : (
          <div className="col-span-full text-start text-gray-600">
            <p>
              No favorites available at the moment. Please check back later.
            </p>
          </div>
        )}
      </div>

      {/* Ant Design Pagination */}
      {pagination && total > 0 && (
        <div className="flex justify-end mt-6">
          <p
            style={{ color: "#667085" }}
            className="mt-1 mr-4 Livvic-Medium text-sm Quicksand"
          >
            Showing {startItem}-{endItem} from {total}
          </p>
          <Pagination
            className="Livvic-Bold Quicksand"
            current={currentPage}
            pageSize={pageSize}
            total={total}
            onChange={handlePageChange}
            showSizeChanger={false}
          />
        </div>
      )}
    </div>
  );
}
