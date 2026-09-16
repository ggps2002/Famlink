import { api } from "@shared/api/client";

// The waitlist forms carry a location in three different shapes: a Google Places
// object (the standalone form and both questionnaires), a plain string, or
// nothing at all. The confirmation email only needs a city to print, and falls
// back to "your area" server-side when it can't get one.
const cityFrom = (location) => {
  if (!location) return "";
  if (typeof location === "string") return location;
  return location.city || location.neighborhood || "";
};

// Send the waitlist confirmation email (template 14) to the address someone just
// signed up with. Every waitlist form in the app goes through this.
//
// Deliberately never throws. The confirmation is a courtesy on top of the real
// work — recording the signup in the sheet — so a mail failure must not take the
// signup down with it, and the caller shows its success state either way. A
// failure is logged and swallowed.
export const sendWaitlistConfirmation = async ({ email, name, location, city, userType, details }) => {
  if (!email) return;
  try {
    await api.post("/waitlist/confirmation", {
      email,
      name: name || "",
      city: city || cityFrom(location),
      // The full place object, so the waitlist row gets a real city and region
      // rather than only whatever string the caller happened to have. The
      // backend keeps the coarse parts and drops the coordinates.
      location: location || null,
      userType: userType || undefined,
      // Every caller of this function is a waitlist join: the button above it
      // reads "Join Waitlist" or "Notify me when you're here", over copy
      // promising an email when we launch nearby. That click is the consent,
      // and not sending it recorded the opposite of what the person agreed to —
      // leaving a waitlist nobody could legally be emailed from.
      notifyConsent: true,
      // The same "Label: value | Label: value" summary the Google Sheet gets.
      // Keeping it on our side too is what lets the console filter the waitlist
      // by what people actually asked for, rather than only by city.
      details: details || "",
    });
  } catch (error) {
    console.error("Waitlist confirmation email failed:", error);
  }
};
