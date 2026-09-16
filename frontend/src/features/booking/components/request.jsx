import { useEffect, useState } from "react";
import Content from "@features/booking/components/content";
import { Pagination } from "antd";
import { fetchOtherReqThunk } from "@features/booking/store/otherRequestsSlice";
import { useDispatch, useSelector } from "react-redux";
import Loader from "@shared/ui/Loader";

export default function Requests({ type }) {
  const [currentPage, setCurrentPage] = useState(1);
  const dispatch = useDispatch();
  const { data, pagination, isLoading } = useSelector(
    (state) => state.otherReqData
  );
  const pageSize = 8; // Number of cards to display per page
  const total = pagination?.total || data?.length || 0; // Total number of profiles
  useEffect(() => {
    const fetchData = async () => {
      await dispatch(
        fetchOtherReqThunk({ limit: pageSize, page: currentPage })
      ).unwrap();
    };
    fetchData();
  }, [dispatch, currentPage, pageSize]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);
  return (
    <div>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          {!data || data.length === 0 ? (
            <p className="text-gray-500 text-start">No requests available</p>
          ) : (
            <>
              {data.map((v) => {
                return (
                  <Content
                    key={v._id}
                    bookingId={v._id}
                    jobDes={type == "nanny" ? v.jobId[v.jobId.jobType].jobDescription : ""}
                    jobTiming={type == "nanny" ? v.jobId[v.jobId.jobType].require : ""}
                    hourlyRate={type == "nanny" ? `${
                      v?.jobId?.[v?.jobId?.jobType]?.hourlyRate?.min
                    }-${v?.jobId?.[v?.jobId?.jobType]?.hourlyRate?.max}` : ""}
                    id={type == "nanny" ? v?.jobId?._id : v.requestBy?._id}
                    img={
                      type == "nanny"
                        ? v?.jobId?.user?.imageUrl
                        : v.requestBy?.imageUrl
                    }
                    name={
                      type == "nanny" ? v?.jobId?.user?.name : v.requestBy?.name
                    }
                    parentId={v?.jobId?.user?._id}
                    nannyId={v.requestBy?._id}
                    start={
                      v.requestBy?.additionalInfo.find(
                        (info) => info.key === "availability"
                      )?.value?.option
                    }
                    time={
                      v.requestBy?.additionalInfo.find(
                        (info) => info.key === "avaiForWorking"
                      )?.value?.option
                    }
                    exp={
                      v.requestBy?.additionalInfo.find(
                        (info) => info.key === "experience"
                      )?.value?.option
                    }
                    loc={
                      type == "nanny"
                        ? v?.jobId?.user?.location
                        : v.requestBy?.location
                    }
                    zipCode={
                      type == "nanny"
                        ? v?.jobId?.user?.zipCode
                        : v.requestBy?.zipCode
                    }
                    child={
                      type == "nanny"
                        ? v?.jobId?.user?.noOfChildren.length
                        : Object.keys(
                            v.requestBy?.additionalInfo.find(
                              (info) => info.key === "noOfChildren"
                            )?.value || {}
                          )?.length
                    }
                    type={type}
                    dayTime={
                      v.requestBy?.additionalInfo.find(
                        (info) => info.key === "specificDaysAndTime"
                      )?.value
                    }
                    createdAt={v.createdAt}
                    request={true}
                  />
                );
              })}

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
                  onChange={handlePageChange}
                  showSizeChanger={false}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
