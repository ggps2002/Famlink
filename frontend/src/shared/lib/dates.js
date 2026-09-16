import { format, isToday, isYesterday } from "date-fns";
import dayjs from "dayjs";

/** Date and time formatting shared across cards, detail views and chat. */

// A nanny share's start date reaches the UI in three shapes: a dayjs object
// straight from the Ant Design picker, an ISO string from the API, and — in
// older records — an ISO string that still carries its JSON quotes
// ('"2026-08-01T00:00:00.000Z"'). The profile card has always normalised all
// three; the detail views printed the raw value, so one share could read
// "August 1, 2026" on its card and "2026-08-01T00:00:00.000Z" on its own page.
export function formatStartDate(value) {
  if (!value) return "";
  if (dayjs.isDayjs(value)) {
    return value.isValid() ? value.format("MMMM D, YYYY") : "Invalid Date";
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/"/g, "");
    const parsed = dayjs(cleaned);
    // Not every answer is a date — some shares say "Flexible" or "ASAP", and
    // those must survive untouched rather than become "Invalid Date".
    return parsed.isValid() ? parsed.format("MMMM D, YYYY") : cleaned;
  }
  return String(value);
}

export const formatTimeRange = (startISO, endISO) => {
  const start = new Date(startISO);
  const end = new Date(endISO);

  const formattedStart = format(start, "hh:mm a");
  const formattedEnd = format(end, "hh:mm a");

  return `${formattedStart} - ${formattedEnd}`;
};

export function formatCreatedAt(dateInput) {
  if (!dateInput) return "";
  const date = new Date(dateInput);

  if (isToday(date)) {
    return `Today, ${format(date, "hh:mm a")}`;
  } else if (isYesterday(date)) {
    return `Yesterday, ${format(date, "hh:mm a")}`;
  } else {
    return `${format(date, "MMMM d")}, ${format(date, "hh:mm a")}`;
  }
}
