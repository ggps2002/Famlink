import multer from "multer";

/**
 * Multipart parsing for the routes that accept a file.
 *
 * Files are held in memory and never touch this machine's disk: every consumer
 * reads `file.buffer` and hands it straight to Cloudinary (see uploadImage.js).
 * That is what makes the app safe to run on an ephemeral filesystem — Fly
 * machines do not keep anything written locally.
 *
 * ── Why the limits are not optional ───────────────────────────────────────
 * `memoryStorage` buffers the entire upload into RAM before any handler runs.
 * Without a cap, a single request can allocate as much memory as the client is
 * willing to send, and the process dies before any application-level size check
 * gets a chance to reject it. The blog cover route, for instance, refuses
 * anything over 8 MB — but that check happens *after* multer has already read
 * the whole thing, so it protects the CDN, not the server.
 *
 * `fileSize` is therefore the real defence and it is deliberately set here, at
 * the one place every upload route shares, rather than per route where a new
 * route would silently be unprotected.
 *
 * 10 MB matches the `express.json` limit in Application.js and sits above every
 * application-level check in the codebase, so it rejects only what is already
 * unreasonable — a modern phone photo is 3-6 MB.
 *
 * `files` matters because three routes use `upload.any()`, which otherwise
 * accepts an unbounded number of parts.
 */
const LIMITS = {
  fileSize: 10 * 1024 * 1024, // 10 MB per file
  files: 10, // parts per request
};

export const upload = multer({ storage: multer.memoryStorage(), limits: LIMITS });

export const UPLOAD_LIMITS = LIMITS;

export default upload;
