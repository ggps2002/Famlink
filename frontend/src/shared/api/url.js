/**
 * The backend's origin, read once from the build-time environment.
 *
 * Vite inlines `import.meta.env` at build time, so this is a constant in the
 * bundle rather than a runtime lookup — changing it means rebuilding, not
 * restarting.
 */
export const BACKEND_API_URL = import.meta.env.VITE_API_BASE_URL;
console.log("API:", BACKEND_API_URL);
