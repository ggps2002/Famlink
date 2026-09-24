import {
  Laugh,
  Star,
  Mic,
  Send,
  ArrowLeft,
  Square,
  X,
  Ban,
  Flag,
  Loader2,
} from "lucide-react";
import { Suspense, lazy, memo } from "react";
import { Button, Input } from "antd";
import line from "@/assets/images/l1.webp";
import { useDispatch, useSelector } from "react-redux";
import Avatar from "react-avatar";
import { useNavigate } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clearSelectedContact } from "@features/chat/store/selectedContactSlice";
import { addOrRemoveFavouriteThunk } from "@features/dashboard/store/favouriteSlice";
import { refreshTokenThunk } from "@features/auth/store/authSlice";
import { formatTime } from "@shared/lib/toCamelCase";
import { getSubscriptionStatusThunk } from "@features/subscription/store/cardSlice";
import CustomButton from "@shared/ui/Button";
import { getMatchWithUserThunk, unblockMatchThunk } from "@features/matching/store/matchSlice";
import { fireToastMessage } from "@shared/ui/toast";
import BlockMatchModal from "@features/matching/components/BlockMatchModal";
import ReportMatchModal from "@features/matching/components/ReportMatchModal";
import { getReportStatusThunk } from "@features/matching/store/reportSlice";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

const ChatView = memo(function ChatView({
  messages,
  handleSendMessage,
  selectedContact,
  user,
  pathname,
  handleCloseChat,
  isOtherUserTyping,
  emitTyping,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const messageWindowRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const timerRef = useRef(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [inputValue, setInputValue] = useState("");
  // Why the last send was refused, shown above the composer. Null when the last
  // send went through, so it clears itself on the next successful message.
  const [sendError, setSendError] = useState(null);

  const subscription = useSelector((state) => state.cardData.subscriptionStatus);
  const isSubscribed = subscription?.active;

  useEffect(() => { dispatch(getSubscriptionStatusThunk()); }, [dispatch]);

  // ── Block state ──
  const [matchInfo, setMatchInfo] = useState(null);
  const [unblocking, setUnblocking] = useState(false);
  const [isBlockModal, setIsBlockModal] = useState(false);
  const otherUserId = selectedContact?.otherParticipant?._id;
  const otherName = selectedContact?.otherParticipant?.name;

  // ── Profile link ──
  //
  // Both member profile screens are keyed by *user* id (the same id the chat
  // list hands back as otherParticipant._id), and which of the two you get is
  // decided by who you are talking to, not by who you are.
  //
  // Null for the Admin support conversation that every inbox carries: support
  // has no member profile, and a header that looks clickable but goes nowhere
  // is worse than one that plainly isn't.
  const profilePath =
    !otherUserId
      ? null
      : selectedContact?.otherParticipant?.type === "Nanny"
      ? `/dashboard/nanny-profile-view/${otherUserId}`
      : selectedContact?.otherParticipant?.type === "Parents"
      ? `/dashboard/family-profile-view/${otherUserId}`
      : null;

  // The open chat stays in the store while the profile is on screen, so the
  // browser Back button drops the reader straight back into this conversation.
  const openProfile = () => {
    if (profilePath) navigate(profilePath);
  };

  // Reflect a successful block locally so the header/banner update immediately.
  const markBlocked = () =>
    setMatchInfo((prev) =>
      prev ? { ...prev, status: "blocked", blockedBy: user?._id } : prev
    );

  // Look up the match (if any) with the selected contact so we can reflect a
  // blocked conversation. Re-runs whenever the open contact changes.
  useEffect(() => {
    if (!otherUserId) {
      setMatchInfo(null);
      return;
    }
    let active = true;
    dispatch(getMatchWithUserThunk({ userId: otherUserId }))
      .unwrap()
      .then((res) => { if (active) setMatchInfo(res?.data ?? null); })
      .catch(() => { if (active) setMatchInfo(null); });
    return () => { active = false; };
  }, [otherUserId, dispatch]);

  const isBlocked = matchInfo?.status === "blocked";
  const blockedByMe =
    isBlocked && String(matchInfo?.blockedBy) === String(user?._id);

  // ── Report state ──
  //
  // Read from the store keyed by user id rather than held locally, so switching
  // contacts can't carry one conversation's "Reported" state into the next —
  // ChatView stays mounted across those switches.
  const [isReportModal, setIsReportModal] = useState(false);
  const hasReported = useSelector(
    (state) => Boolean(state.report?.reportedUsers?.[otherUserId]?.reported)
  );

  // Ask the server whether this person has already been reported by us, so the
  // button reads "Reported" after a refresh instead of resetting and inviting a
  // duplicate report.
  useEffect(() => {
    if (!otherUserId) return;
    dispatch(getReportStatusThunk({ userId: otherUserId }));
  }, [otherUserId, dispatch]);

  const handleUnblock = async () => {
    if (!matchInfo?.matchId) return;
    setUnblocking(true);
    try {
      await dispatch(unblockMatchThunk({ matchId: matchInfo.matchId })).unwrap();
      setMatchInfo((prev) =>
        prev ? { ...prev, status: "accepted", blockedBy: null } : prev
      );
      fireToastMessage({ type: "success", message: "Profile unblocked" });
    } catch (error) {
      fireToastMessage({
        type: "error",
        message: error?.message || "Server error",
      });
    } finally {
      setUnblocking(false);
    }
  };

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isInitialLoad = useRef(true);

  // Reset the "initial load" flag whenever the selected contact changes.
  // ChatView stays mounted across contact switches (it's memoized and the
  // parent just swaps props), so without this, isInitialLoad.current would
  // only ever be true once for the component's entire lifetime — meaning
  // switching to a new contact wouldn't snap to the bottom of *their*
  // message history; it would just check distance-from-bottom against
  // whatever scroll position was left over from the previous contact.
  useLayoutEffect(() => {
    isInitialLoad.current = true;
  }, [selectedContact?._id]);

  useLayoutEffect(() => {
    const el = messageWindowRef.current;
    if (!el) return;

    // On refresh (or first open of a contact), `messages` starts as an
    // empty array while the socket snapshot / API fetch is still in
    // flight. Don't let that empty render consume the "initial load"
    // flag — otherwise, by the time the real messages arrive a moment
    // later, isInitialLoad.current is already false, and the "only
    // scroll if near bottom" branch runs against a scrollTop of 0 from
    // the empty container, so it never snaps to the bottom.
    if (messages.length === 0) return;

    if (isInitialLoad.current) {
      el.scrollTop = el.scrollHeight;
      isInitialLoad.current = false;
      return;
    }

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isOtherUserTyping]);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  const nannyShare = pathname.split("/")[1] === "family" && "Parents";

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
        const base64Audio = await blobToBase64(audioBlob);
        try {
          await handleSendMessage({
            chatId: selectedContact?._id,
            content: base64Audio,
            senderId: user?._id,
            receiverId: selectedContact?.otherParticipant._id,
            type: "Audio",
          });
        } catch (err) {
          // A send can now be refused by the server — a blocked conversation,
          // or sending too fast. Unlike a typed message there is no text to
          // restore, so the failure is reported and the recording is gone;
          // swallowing it would leave the recorder looking like it worked.
          console.error("Failed to send voice message:", err);
          setSendError(err?.message || "Voice message could not be sent.");
        }
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) { mediaRecorder.current.stop(); setIsRecording(false); }
  };

  const cancelRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      audioChunks.current = [];
    }
  };

  const handleFavourite = async (id) => {
    await dispatch(addOrRemoveFavouriteThunk({ favouriteUserId: id }));
    await dispatch(refreshTokenThunk());
  };

  const formatTime1 = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // The most recent message from the other person, attached to a report so the
  // moderator sees what prompted it. Text only — a report whose evidence is a
  // base64 voice note gives a moderator nothing readable to act on, and the
  // backend snapshots the content as a string.
  const lastMessageFromOther = [...messages]
    .reverse()
    .find(
      (message) =>
        message?.sender?._id &&
        String(message.sender._id) !== String(user?._id) &&
        message.type !== "Audio"
    );

  const sendTextMessage = async () => {
    const messageText = inputValue.trim();
    if (!messageText) return;
    setInputValue("");
    setSendError(null);
    try {
      await handleSendMessage({
        chatId: selectedContact?._id,
        content: messageText,
        senderId: user?._id,
        receiverId: selectedContact?.otherParticipant?._id,
        type: "Text",
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      // Put the text back so a refused message isn't simply lost, and say why.
      // Silently restoring it reads as a glitch and the sender just presses
      // send again — which fails again for the same unstated reason.
      setInputValue(messageText);
      setSendError(err?.message || "Message could not be sent.");
    }
  };

  // Avatar, name and presence — the header's identity block. Held in a variable
  // because it renders inside a button when there's a profile to open and a
  // plain div when there isn't, and the two must not drift apart.
  const headerIdentity = (
    <>
      <div className="shrink-0 relative">
        {selectedContact?.otherParticipant?.imageUrl ? (
          <img
            src={selectedContact.otherParticipant.imageUrl}
            alt={selectedContact.otherParticipant.name}
            className="w-10 h-10 rounded-full object-cover"
            style={{ backgroundColor: "#AEC4FF" }}
          />
        ) : (
          <Avatar
            size="40"
            color="#AEC4FF"
            name={otherName?.split(" ").slice(0, 2).join(" ")}
            className="rounded-full"
          />
        )}
        {selectedContact?.otherParticipant?.online && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
        )}
      </div>

      <div className="flex flex-col min-w-0">
        <span className="Livvic-SemiBold text-base sm:text-lg text-gray-900 truncate group-hover:underline underline-offset-2 decoration-gray-400">
          {otherName}
        </span>
        {isOtherUserTyping ? (
          <span className="Livvic text-xs" style={{ color: "#AEC4FF" }}>
            typing…
          </span>
        ) : selectedContact?.otherParticipant?.online ? (
          <span className="Livvic text-xs text-green-500">Online</span>
        ) : null}
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full w-full bg-white relative overflow-hidden">

      {isBlockModal && (
        <BlockMatchModal
          matchId={matchInfo?.matchId}
          name={selectedContact?.otherParticipant?.name}
          setIsBlockModal={setIsBlockModal}
          onBlocked={markBlocked}
        />
      )}

      {isReportModal && (
        <ReportMatchModal
          reportedUserId={otherUserId}
          name={selectedContact?.otherParticipant?.name}
          chatId={selectedContact?._id}
          // The other person's most recent message, so the report arrives with
          // the thing being complained about attached. The backend snapshots
          // its text on file, which is what keeps the evidence after the sender
          // deletes it — the usual next move once someone realises.
          messageId={lastMessageFromOther?._id}
          setIsReportModal={setIsReportModal}
          // The store already records this on success; the modal calls back so
          // the header can settle into "Reported" as the dialog closes rather
          // than a frame later.
          onReported={() => setIsReportModal(false)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex justify-between items-center px-4 sm:px-5 border-b border-gray-100 h-16 shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Back arrow — mobile only */}
          <button
            className="sm:hidden p-1 shrink-0"
            onClick={() => { handleCloseChat(); dispatch(clearSelectedContact()); }}
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>

          {/* Avatar + name open the profile. The name underlines on hover so
              the header reads as a link without needing a button of its own —
              `group` is what makes hovering the avatar underline it too. */}
          {profilePath ? (
            <button
              type="button"
              onClick={openProfile}
              title={`View ${otherName}'s profile`}
              aria-label={`View ${otherName}'s profile`}
              className="group flex items-center gap-3 min-w-0 text-left cursor-pointer"
            >
              {headerIdentity}
            </button>
          ) : (
            <div className="flex items-center gap-3 min-w-0">{headerIdentity}</div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Report sits next to Block, and unlike Block it stays available on
              a blocked conversation. Blocking someone is often the first thing
              you do and reporting them the thing you work up to — losing the
              button at that point means the worst behaviour goes unreported. */}
          {otherUserId &&
            (hasReported ? (
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm Livvic-Medium text-amber-600 bg-amber-50 cursor-default"
                title="You've reported this profile. Our team is reviewing it."
              >
                <Flag size={18} fill="currentColor" />
                <span className="hidden sm:inline">Reported</span>
              </span>
            ) : (
              <CustomButton
                type="button"
                onClick={() => setIsReportModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm Livvic-Medium text-gray-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                aria-label="Report profile"
              >
                <Flag size={18} />
                <span className="hidden sm:inline">Report</span>
              </CustomButton>
            ))}

          {matchInfo?.status === "accepted" && (
            <CustomButton
              type="button"
              onClick={() => setIsBlockModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm Livvic-Medium text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"
              aria-label="Block profile"
            >
              <Ban size={18} />
              <span className="hidden sm:inline">Block</span>
            </CustomButton>
          )}
          {nannyShare !== selectedContact?.otherParticipant?.type &&
            pathname.split("/")[1] !== "nanny" && (
              <button
                className="p-1.5"
                onClick={() => handleFavourite(selectedContact?.otherParticipant?._id)}
              >
                <Star
                  size={20}
                  fill={user.favourite?.includes(selectedContact?.otherParticipant?._id) ? "#AEC4FF" : "white"}
                  color="#AEC4FF"
                  className="cursor-pointer"
                />
              </button>
            )}
        </div>
      </div>

      {/* ── Messages area ── */}
      <div
        ref={messageWindowRef}
        className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-1"
      >
        {messages.map((message, index) => {
          const isMine = message?.sender?._id === user?._id;
          return (
            <div key={index} className={`flex ${isMine ? "justify-end" : "justify-start"} py-1`}>
              {message.type === "Audio" ? (
                <div
                  className={`w-[75%] rounded-2xl px-4 py-3 ${isMine ? "sender-audio-player" : "receviver-audio-player"}`}
                >
                  <p
                    className="Livvic text-xs mb-1"
                    style={{ color: isMine ? "rgba(255,255,255,0.85)" : "#5B7BA8" }}
                  >
                    {formatTime(message.updatedAt)}
                  </p>
                  <audio controls controlsList="nodownload" className="w-full max-w-full block">
                    <source src={`data:audio/mp3;base64,${message.content}`} type="audio/mp3" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              ) : (
                <div
                  className="max-w-[75%] sm:max-w-xs lg:max-w-sm xl:max-w-md rounded-2xl px-4 py-3 break-words"
                  style={{ backgroundColor: "#F5F5F5", color: "#555555" }}
                >
                  <p style={{ color: "#AFB8CF" }} className="Livvic text-xs mb-1">
                    {formatTime(message.updatedAt)}
                  </p>
                  <p className="Livvic text-sm sm:text-base leading-relaxed">{message.content}</p>
                </div>
              )}
            </div>
          );
        })}

        {isOtherUserTyping && (
          <div className="flex justify-start py-1">
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-1"
              style={{ backgroundColor: "#F5F5F5" }}
            >
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      {/* ── Input bar / blocked banner ── */}
      {isBlocked ? (
        <div className="border-t border-gray-100 px-4 sm:px-5 min-h-[70px] py-3 shrink-0 flex flex-col sm:flex-row items-center justify-center gap-3 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-500">
            <Ban size={18} />
            <span className="Livvic-Medium text-sm">
              {blockedByMe ? "You've blocked this profile" : "This profile is unavailable"}
            </span>
          </div>
          {blockedByMe && (
            <CustomButton
              type="button"
              onClick={handleUnblock}
              disabled={unblocking}
              className="flex items-center justify-center gap-2 bg-[#AEC4FF] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white Livvic-SemiBold text-sm rounded-full px-5 py-2 transition"
            >
              {unblocking ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Unblocking…
                </>
              ) : (
                "Unblock"
              )}
            </CustomButton>
          )}
        </div>
      ) : (
      <div className="border-t border-gray-100 px-4 sm:px-5 min-h-[70px] shrink-0 flex items-center gap-3 relative bg-white pb-[env(safe-area-inset-bottom)]">
        {/* Why the last message didn't send. Sits above the composer, with the
            rejected text still in the box, so the correction and the reason for
            it are in the same place. */}
        {sendError && (
          <div className="absolute left-4 right-4 sm:left-5 sm:right-5 bottom-full mb-2 flex items-start gap-2 rounded-2xl bg-red-50 border border-red-100 px-4 py-2.5">
            <Ban size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="Livvic text-xs text-red-600 leading-relaxed flex-1">
              {sendError}
            </p>
            <button
              type="button"
              onClick={() => setSendError(null)}
              className="text-red-400 hover:text-red-600 shrink-0"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Emoji button */}
        <button
          className="shrink-0 p-1.5 -m-1.5"
          onClick={() => setShowEmojiPicker((p) => !p)}
        >
          <Laugh size={24} fill="#AEC4FF" color="white" className="cursor-pointer" />
        </button>

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute left-2 right-2 sm:left-4 sm:right-auto bottom-[74px] z-[3000] shadow-xl rounded-2xl overflow-hidden sm:w-[350px]"
          >
            <Suspense fallback={<div className="p-4 Livvic text-sm text-gray-400">Loading…</div>}>
              <EmojiPicker
                searchDisabled
                width="100%"
                height={380}
                onEmojiClick={(emoji) => setInputValue((prev) => prev + emoji.emoji)}
              />
            </Suspense>
          </div>
        )}

        {isRecording ? (
          /* Recording indicator */
          <div
            className="flex flex-1 items-center gap-3 px-4 py-2 rounded-xl"
            style={{ background: "#DCE6FF" }}
          >
            <div className="wave-container">
              <div className="wave" /><div className="wave" /><div className="wave" />
            </div>
            <span className="Livvic-Medium text-sm" style={{ color: "#AEC4FF" }}>
              Recording… {formatTime1(recordingTime)}
            </span>
          </div>
        ) : (
          /* Text input */
          <div className="flex flex-1 items-center">
            <Input
              type="text"
              placeholder="Type a message..."
              style={{ border: "none", boxShadow: "none", width: "100%", fontFamily: "Livvic-Medium", fontSize: 15 }}
              prefix={<img className="object-contain" src={line} alt="" />}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                emitTyping?.(selectedContact?._id);
              }}
              onPressEnter={(e) => { e.preventDefault(); sendTextMessage(); }}
            />
            <Button
              style={{ border: "none", boxShadow: "none" }}
              onClick={sendTextMessage}
            >
              <Send size={20} color="#AEC4FF" className="cursor-pointer" />
            </Button>
          </div>
        )}

        {/* Mic / stop / cancel */}
        {isRecording ? (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={cancelRecording} className="text-red-400 hover:text-red-500 p-1.5 -m-1.5">
              <X size={20} />
            </button>
            <button onClick={stopRecording} style={{ color: "#AEC4FF" }} className="p-1.5 -m-1.5">
              <Square size={20} />
            </button>
          </div>
        ) : (
          <button onClick={startRecording} style={{ color: "#AEC4FF" }} className="shrink-0 p-1.5 -m-1.5">
            <Mic size={22} />
          </button>
        )}
      </div>
      )}

      <style>{`
        .typing-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background-color: #9AA5B1;
          animation: typing-dot-bounce 1.2s infinite ease-in-out;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.15s; }
        .typing-dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes typing-dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
});

export default ChatView;