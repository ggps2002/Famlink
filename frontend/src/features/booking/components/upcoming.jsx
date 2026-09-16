import { useEffect, useState } from "react";
import Content from "@features/booking/components/content";
import Loader from "@shared/ui/Loader";
import { Pagination } from 'antd';
import { useDispatch, useSelector } from "react-redux";
import { fetchAccRequesterThunk } from "@features/booking/store/acceptedRequesterSlice";

export default function Upcoming({ type }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(false); // State for loader
    const dispatch = useDispatch();
    const { data, pagination } = useSelector((s) => s.acceptRequesterData);
    const pageSize = 8; // Number of cards to display per page
    const total = data?.length > 0 && data?.length; // Total number of profiles

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true); // Show loader before fetching data
            await dispatch(fetchAccRequesterThunk({ limit: pageSize, page: currentPage })).unwrap();
            setLoading(false); // Hide loader after fetching data
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
            {loading ? ( // Show loader while data is being fetched
                <Loader />
            ) : (
                <>
                    {/* Show message if there's no data */}
                    {!data || data?.length === 0 ? (
                        <p className="text-gray-500 text-start">No upcoming booking available</p>
                    ) : (
                        <>
                            {/* Display paginated profiles */}
                            {data &&
                                data.map((v) => {
                                    const additionalInfo = type === 'family' ? v.nannyId?.additionalInfo ?? [] : v.familyId?.additionalInfo ?? [];

                                    return (
                                        <Content
                                            key={v._id}
                                            bookingId={v._id}
                                            id={type === 'family' ? v.nannyId?._id : v.familyId?._id}
                                            img={type === 'family' ? v.nannyId?.imageUrl : v.familyId?.imageUrl}
                                            name={type === 'family' ? v.nannyId?.name : v.familyId?.name}
                                            start={type === 'family' ? additionalInfo.find(info => info.key === "availability")?.value?.option : null}
                                            time={type === 'family' ? additionalInfo.find(info => info.key === "avaiForWorking")?.value?.option : null}
                                            exp={type === 'family' ? additionalInfo.find(info => info.key === 'experience')?.value?.option : null}
                                            loc={type === 'family' ? v.nannyId?.location : v.familyId?.location}
                                            zipCode={type === 'family' ? v.nannyId?.zipCode : v.familyId?.zipCode}
                                            child={
                                                type === 'nanny' &&
                                                Object.keys(additionalInfo.find(info => info.key === 'noOfChildren')?.value || {}).length
                                            }
                                            dayTime={
                                                type === 'nanny' ? additionalInfo.find(info => info.key === 'specificDaysAndTime')?.value : null
                                            }
                                            type={type}
                                            upcoming={true}
                                        />
                                    );
                                })
                            }


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
