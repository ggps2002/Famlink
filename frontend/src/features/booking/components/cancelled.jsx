import { useEffect, useState } from "react";
import Content from "@features/booking/components/content";
import { Pagination } from 'antd';
import { useDispatch, useSelector } from "react-redux";
import { fetchCancelRequesterThunk } from "@features/booking/store/cancelledRequestSlice";
import Loader from "@shared/ui/Loader"; // Assuming you have a Loader component

export default function Cancelled({ type }) {
    const [currentPage, setCurrentPage] = useState(1);
    const dispatch = useDispatch();
    const { data, pagination, isLoading } = useSelector((s) => s.cancelReqData); // Include isLoading from Redux state
    const pageSize = 8; // Number of cards to display per page
    const total = pagination?.total || data?.length || 0; // Fallback to pagination total

    useEffect(() => {
        const fetchData = async () => {
            await dispatch(fetchCancelRequesterThunk({ limit: pageSize, page: currentPage })).unwrap();
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
            {/* Loader displayed while data is being fetched */}
            {isLoading ? (
                <Loader />
            ) : (
                <>
                    {/* Show message if there's no data */}
                    {!data || data.length === 0 ? (
                        <p className="text-gray-500 text-start">No cancelled booking available</p>
                    ) : (
                        <>
                            {/* Use paginatedProfiles to only display the current page's data */}
                            {data.map((v) => (
                                <Content
                                    key={v._id}
                                    bookingId={v._id}
                                    id={type == 'nanny' ? v?.jobId?._id : v.requestBy?._id}
                                    img={type == 'nanny' ? v?.jobId?.user?.imageUrl : v.requestBy?.imageUrl}
                                    name={type == 'nanny' ? v?.jobId?.user?.name : v.requestBy?.name}
                                    parentId={v?.jobId?.user?._id}
                                    nannyId={v.requestBy?._id}
                                    start={
                                        v.requestBy?.additionalInfo.find(
                                            (info) => info.key === 'availability'
                                        )?.value?.option
                                    }
                                    time={
                                        v.requestBy?.additionalInfo.find(
                                            (info) => info.key === 'avaiForWorking'
                                        )?.value?.option
                                    }
                                    exp={
                                        v.requestBy?.additionalInfo.find(
                                            (info) => info.key === 'experience'
                                        )?.value?.option
                                    }
                                    loc={type == 'nanny' ? (v?.jobId?.user?.location) : v.requestBy?.location}
                                    zipCode={type == 'nanny' ? (v?.jobId?.user?.zipCode) : v.requestBy?.zipCode}
                                    child={type == 'nanny' ? (v?.jobId?.user?.noOfChildren.length) :
                                        Object.keys(
                                            v.requestBy?.additionalInfo.find(
                                                (info) => info.key === 'noOfChildren'
                                            )?.value || {}
                                        )?.length
                                    }
                                    type={type}
                                    dayTime={
                                        v.requestBy?.additionalInfo.find(
                                            (info) => info.key === 'specificDaysAndTime'
                                        )?.value
                                    }
                                    cancelled={true}
                                />
                            ))}

                            {/* Pagination and results count */}
                            <div className="flex justify-end mt-6">
                                <p style={{ color: "#667085" }} className="mt-1 mr-4 Livvic-Medium text-sm Quicksand">
                                    Showing {startItem}-{endItem} from {total}
                                </p>
                                <Pagination
                                    className="Livvic-Bold pagination-custom Quicksand"
                                    current={currentPage}
                                    pageSize={pageSize}
                                    total={pagination?.total || total}
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
