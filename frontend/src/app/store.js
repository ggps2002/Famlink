import { configureStore } from '@reduxjs/toolkit'
import { setAccessTokenReader, setSessionGate } from '@shared/api/client'
import additionalServicesSlice from '@features/auth/store/additionalServicesSlice'
import setFamilyExp from '@features/auth/store/familyExperienceSlice'
import formSlice from '@shared/store/formValueSlice'
import authSlice from '@features/auth/store/authSlice'
// The `es/` build, not `lib/`: `lib/` is CommonJS that sets `exports.__esModule`
// by plain assignment, which Vite 8's interop does not treat as an ES module.
// The default import then lands on `{ __esModule, default }` instead of the
// storage object, and redux-persist throws "getItem is not a function" at
// rehydrate. `redux-persist` and `redux-persist/integration/react` both
// resolve to `es/` already via their `module` field; these deep paths have no
// such redirect, so they have to name it.
import storage from "redux-persist/es/storage";
import { persistReducer, persistStore } from "redux-persist";
import autoMergeLevel2 from "redux-persist/es/stateReconciler/autoMergeLevel2";
import nannyListSlice from '@features/dashboard/store/nannyDataSlice'
import favouriteSlice from '@features/dashboard/store/favouriteSlice'
import cardSlice from '@features/subscription/store/cardSlice'
import updateSlice from '@features/dashboard/store/updateSlice'
import bookHireSlice from '@features/hire/store/bookHireSlice'
import familyListSlice from '@features/dashboard/store/familyDataSlice'
import reqDataSlice from '@features/booking/store/requestedDataSlice'
import fetchOtherReqSlice from '@features/booking/store/otherRequestsSlice'
import requesterDataSlice from '@features/booking/store/acceptedRequesterSlice'
import comReqDataSlice from '@features/booking/store/completedRequestSlice'
import cancelReqDataSlice from '@features/booking/store/cancelledRequestSlice'
import withdrawDataSlice from '@features/booking/store/withdrawRequestSlice'
import reviewData from '@features/dashboard/store/reviewSlice'
import chatSLice from '@features/chat/store/chatSlice'
import selectedContactSlice from '@features/chat/store/selectedContactSlice'
import notificationSlice from '@features/notifications/store/notificationSlice'
import forgetPassSlice from '@features/auth/store/forgetPasswordSlice'
import postNannyShareSlice from '@features/nanny-share/store/nannyShareSlice'
import jobPostSlice from '@features/jobs/store/postJobSlice'
import smsSlice from '@features/auth/store/smsSlice'
import emailSlice from '@features/auth/store/emailSlice'
import matchSlice from '@features/matching/store/matchSlice'
import referralSlice from '@features/referral/store/referralSlice'
import shareProfileSlice from '@features/share-link/store/shareProfileSlice'
import reportSlice from '@features/matching/store/reportSlice'
import { authPersistTransform, discardStoredTokens } from '@features/auth/store/persistedUser'
import { restoreSession } from '@features/auth/store/restoreSession'

const authPersistConfig = {
  key: "auth",
  storage,
  stateReconciler: autoMergeLevel2,
  blacklist: ["isLoading"], // Optionally, you may not want to persist loading state
  // No tokens. This list used to include `accessToken` and `refreshToken`, which
  // meant both credentials sat in localStorage — readable by any script on the
  // page, and the refresh token good for seven days from anywhere once copied.
  //
  // Now the refresh token is in an httpOnly cookie that JavaScript cannot read,
  // and the access token lives in this store and dies with the tab. What is left
  // here is the user shell, kept only so a reload does not flash a logged-out
  // page while `restoreSession` trades the cookie for a new access token.
  whitelist: ["user"],
  // `authPersistTransform` strips PII, financial identifiers and internal
  // moderation notes out of the user object before it reaches localStorage. The
  // whitelist above decides WHICH slice keys persist; this decides what may be
  // inside `user`.
  //
  // `discardStoredTokens` covers the other direction, and is not redundant with
  // the whitelist: redux-persist consults the whitelist only when WRITING, so
  // tokens already in an existing browser's copy of this blob would still be
  // rehydrated out of it. See the note on the transform.
  transforms: [authPersistTransform, discardStoredTokens],
};

export const store = configureStore({
  reducer: {
    email: emailSlice,
    sms: smsSlice,
    additionalSer: additionalServicesSlice,
    familyExp: setFamilyExp,
    form: formSlice,
    auth: persistReducer(authPersistConfig, authSlice),
    nannyData: nannyListSlice,
    favouriteData: favouriteSlice,
    cardData: cardSlice,
    update: updateSlice,
    bookHire: bookHireSlice,
    familyData: familyListSlice,
    reqData: reqDataSlice,
    otherReqData: fetchOtherReqSlice,
    acceptRequesterData: requesterDataSlice,
    completeRequesterData: comReqDataSlice,
    cancelReqData: cancelReqDataSlice,
    withdrawData: withdrawDataSlice,
    reviews: reviewData,
    matchRequest: matchSlice,
    report: reportSlice,
    referral: referralSlice,
    shareProfile: shareProfileSlice,
    chat: chatSLice,
    selectedContact: selectedContactSlice,
    notifications: notificationSlice,
    postNannyShare: postNannyShareSlice,
    jobPost: jobPostSlice,
    forgetPassSlice
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
})

// Hand the client a way to read the session, rather than having it import this
// module. That inversion is what keeps store → slices → client acyclic; see the
// note in @shared/api/client for what broke when the arrow pointed both ways.
setAccessTokenReader(() => store.getState()?.auth?.accessToken);

/**
 * Hold every outgoing request until the session has been restored.
 *
 * The gate is closed here, at module scope, rather than when rehydration
 * finishes — by then React may already have mounted and fired the first
 * requests, and those are precisely the ones that must not go out without an
 * Authorization header. Closing it synchronously on import means no request can
 * slip in front of it.
 *
 * It opens once `restoreSession` has decided one way or the other, and the
 * client caps how long it can stay shut so a rehydration that never calls back
 * cannot freeze the app.
 */
let openSessionGate;
setSessionGate(new Promise((resolve) => {
  openSessionGate = resolve;
}));

export const persistor = persistStore(store, null, () => {
  // Only now is `auth.user` back from localStorage, which is what
  // restoreSession reads to decide whether anyone was signed in at all.
  // `catch` before `finally`: restoreSession handles its own failures, but an
  // unexpected throw must still open the gate rather than leaving every request
  // in the app waiting on a promise nobody is going to settle.
  restoreSession(store).catch(() => {}).finally(openSessionGate);
});
