// Wraps the native fetch with an AbortController-based timeout.
//
// Several onboarding / job-posting submit handlers POST to a Google Apps
// Script endpoint. That endpoint can hang without ever responding, which left
// the "Saving Responses" spinner stuck forever because the `await` never
// settled (so neither `setIsLoading(false)` nor the `catch` block ran).
//
// With a timeout the request is aborted after `timeoutMs`, fetch rejects with
// an AbortError, and the caller's existing `catch` clears the spinner and shows
// an error the user can retry from.
export const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

export default fetchWithTimeout;
