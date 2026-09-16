/**
 * Email bodies for feedback notifications.
 *
 * Separated from the service because HTML in the middle of business logic is
 * how the 1000-line route files got that way — and because the message body is
 * the part most likely to be edited by someone who should not have to read the
 * surrounding rules to do it safely.
 */

/** Notice sent to every admin when feedback arrives. */
export const adminFeedbackNotice = ({ category, email, message }) => `
      <div style="padding: 12px; font-family: Arial, sans-serif;">
        <h2 style="color: #14558F;">New Feedback Submitted</h2>
        <p><b>Category:</b> ${category}</p>
        <p><b>From:</b> ${email}</p>
        <p><b>Message:</b></p>
        <div style="background: #f5f5f5; padding: 10px; border-radius: 5px;">
          ${message}
        </div>
        <br>
        <a href="https://admin.famylink.us/"
           style="padding: 10px 15px; background: #14558F; color: white; text-decoration: none; border-radius: 5px;">
          View Dashboard
        </a>
      </div>
    `;

export default { adminFeedbackNotice };
