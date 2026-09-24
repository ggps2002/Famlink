import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Avatar from "react-avatar";
import Loader from "@shared/ui/Loader";
import { acceptIncomingRequestThunk } from "@features/matching/store/matchSlice";
import { getFamilyGoal, getNannyGoal } from "@features/nanny-share/shareTypeTheme";
import { fireToastMessage } from "@shared/ui/toast";
import RejectMatchModal from "@features/matching/components/RejectMatchModal";

import CustomButton from "@shared/ui/Button";
// Abbreviate to first name + last initial (matches the profile cards' privacy
// treatment before a match is accepted). "Jessica Miller" → "Jessica M."
const formatName = (name) => {
    if (!name) return "";
    const parts = name.trim().split(" ");
    const first = parts[0] || "";
    const last = parts[1] ? ` ${parts[1][0].toUpperCase()}.` : "";
    return `${first}${last}`;
};

// Short, human location from the populated user's location object.
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

/* ─── Request profile card (matches the "Matches" mock, Requests section) ───
   A compact one-line profile card: themed avatar, name, "Role • Goal · Location"
   meta line, and the Accept / Decline actions on the right. Kept intentionally
   light-weight (vs. the full FamilyProfile/NannyProfile cards on the "View All"
   page) so it reads cleanly inside the dashboard feed. */
const RequestProfileCard = ({ profile, setChatUserId, setMatchRequestSuccessModal }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [accepting, setAccepting] = useState(false);
    const [isRejectModal, setIsRejectModal] = useState(false);

    const isFamily = profile.userId?.type === "Parents";
    const role = isFamily ? "Family" : "Nanny";
    const goal = isFamily
        ? getFamilyGoal(profile.hasNanny)
        : getNannyGoal(profile.hasFamily);
    const rawName = profile.userId?.name;
    const name = formatName(rawName);
    const img = isFamily ? profile.userId?.imageUrl : profile.imageFile;
    const location = formatLocation(profile.userId?.location);
    const userId = profile.userId?._id;
    const matchId = profile.matchId;
    const detailsPath = isFamily
        ? `/dashboard/family-profile-view/${profile._id}`
        : `/dashboard/nanny-profile-view/${profile._id}`;

    const handleAccept = async () => {
        setAccepting(true);
        try {
            await dispatch(acceptIncomingRequestThunk({ matchId })).unwrap();
            setChatUserId?.(userId);
            setMatchRequestSuccessModal?.(true);
        } catch (error) {
            fireToastMessage({ type: "error", message: "Server error" });
        } finally {
            setAccepting(false);
        }
    };

    return (
        <div className="flex items-center gap-3 sm:gap-4 px-6 sm:px-0 py-4 border-b border-gray-100 last:border-b-0">
            {isRejectModal && (
                <RejectMatchModal matchId={matchId} setIsRejectModal={setIsRejectModal} />
            )}

            {/* Avatar */}
            <button
                type="button"
                onClick={() => navigate(detailsPath)}
                className="shrink-0"
                aria-label={`View ${name}'s profile`}
            >
                <div className="w-12 h-12 rounded-lg overflow-hidden">
                    {img ? (
                        <img
                            src={img}
                            alt={name}
                            className="w-12 h-12 rounded-full object-cover"
                        />
                    ) : (
                        <Avatar
                            name={rawName}
                            size="48"
                            color="#C8D8FF"
                            fgColor="#001243"
                            className="Livvic-Bold"
                        />
                    )}
                </div>
            </button>

            {/* Name + meta */}
            <button
                type="button"
                onClick={() => navigate(detailsPath)}
                className="flex-1 min-w-0 text-left"
            >
                <p className="Livvic-Bold text-base text-[#0D134C] truncate">{name}</p>
                <p className="Livvic-Medium text-sm text-gray-400 truncate">
                    <span>{role}</span>
                    <span> • </span>
                    <span>{goal}</span>
                    <span> • </span>
                    {location && <span>{location}</span>}
                </p>
            </button>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
                <CustomButton
                    type="button"
                    onClick={handleAccept}
                    disabled={accepting}
                    className="flex items-center justify-center gap-1.5 bg-[#AEC4FF] hover:bg-[#9db4f7] text-[#0D134C] Livvic-SemiBold text-sm px-5 py-2 rounded-lg min-w-[92px] shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                    {accepting ? (
                        <>
                            <Loader2 size={15} className="animate-spin" />
                            <span className="hidden sm:inline">Accepting…</span>
                        </>
                    ) : (
                        "Accept"
                    )}
                </CustomButton>
                <CustomButton
                    type="button"
                    onClick={() => setIsRejectModal(true)}
                    className="Livvic-SemiBold text-sm text-gray-500 px-5 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                    Decline
                </CustomButton>
            </div>
        </div>
    );
};

const ChatInterfaceRequests = ({
    matches,
    isMatchLoading,
    setChatUserId,
    setIsRequestMatchSuccessModal,
}) => {
    return (
        <div>
            {isMatchLoading && <Loader />}
            {matches.length > 0 ? (
                matches.map((profile) => (
                    <RequestProfileCard
                        key={profile._id}
                        profile={profile}
                        setChatUserId={setChatUserId}
                        setMatchRequestSuccessModal={setIsRequestMatchSuccessModal}
                    />
                ))
            ) : (
                <div className="flex justify-center items-center w-full h-[200px] Livvic text-gray-400">
                    No Pending Requests
                </div>
            )}
        </div>
    );
};

export default ChatInterfaceRequests;
