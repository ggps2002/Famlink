/**
 * The "you've received a review" notice.
 *
 * The two variants differ only in the call-to-action — a family who was
 * reviewed is sent to the job board, a caregiver to the hire board — so the
 * shared body is written once and the destination is the parameter.
 */
const BOARDS = {
  Parents: { url: "https://famylink.us/nanny", label: "Job Board", noun: "booking" },
  Nanny: { url: "https://famylink.us/family", label: "Hire Board", noun: "job" },
};

export const reviewReceived = ({ reviewer, rating, msg }) => {
  const board = BOARDS[reviewer?.type];
  // Any other account type gets no notice, preserved from the original, which
  // branched only on Parents and Nanny.
  if (!board) return null;

  return {
    subject: `⭐ New Review after completing "${reviewer.name}" ${board.noun}!`,
    body: `<div style="padding: 12px">
            <h2 style="color: #28a745;">You've Received a New Review!</h2>
            <p><strong>Reviewer:</strong> ${reviewer.name}</p>
            <p><strong>Rating:</strong> ⭐ ${rating} / 5</p>
            <p><strong>Message:</strong> "${msg}"</p>
            <br>
            <a href="${board.url}" style="padding: 10px 15px; background: #d9534f; color: white; text-decoration: none; border-radius: 5px;">${board.label}</a>
            <br><br>
            <p style="font-size: 14px; color: #555;">Need help? Contact us at <a href="mailto:info@famylink.us">info@famylink.us</a></p>
          </div>`,
  };
};

export default { reviewReceived };
