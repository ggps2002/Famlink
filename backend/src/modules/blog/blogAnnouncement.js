import { sendEmail } from "../../shared/email/email.js";
import { userRepository } from "../user/user.repository.js";

/**
 * Where a member lands when they follow the "read it" button.
 *
 * Caregivers and families have separate resource screens, so the link has to
 * match the account or they arrive somewhere they cannot navigate from.
 */
const readLinkFor = (type) => {
  if (type === "Nanny") return "https://famylink.us/nanny/tipsAndArticles";
  if (type === "Parents") return "https://famylink.us/family/tipsAndArticles";
  return "https://famylink.us/blogs";
};

const template = ({ title, category, link }) => `<div style="padding: 12px">
          <h2 style="color: #14558F;">New Blog: ${title}</h2>
          <p>A new blog has been posted in the <strong>${category}</strong> category. 🎉</p>
          <p>Check it out now and stay updated with the latest tips and tricks!</p>
          <br>
          <a href="${link}" style="padding: 10px 15px; background: #F98300; color: white; text-decoration: none; border-radius: 5px;">Read Blog</a>
          <br><br>
          <p style="font-size: 14px; color: #555;">
            Need help? Contact us at <a href="mailto:info@famylink.us">info@famylink.us</a>
          </p>
        </div>`;

/**
 * Email every subscribed member about a newly published article.
 *
 * The recipient list is the one place this has to be careful: it excludes
 * admins, and it excludes anyone who has switched the newsletter off. The test
 * is `$ne: false` rather than `true`, because the field did not always exist —
 * a member who predates it has no value at all and is still subscribed.
 *
 * Sends are not awaited individually, matching the original: this runs
 * fire-and-forget behind a publish, and one bad address must not stop the rest
 * of the list.
 */
export const notifyUsersAboutNewBlog = async (title, category) => {
  try {
    const users = await userRepository.find(
      {
        type: { $ne: "Admin" },
        "notifications.email.newsletter": { $ne: false },
      },
      { select: "email type", lean: true }
    );

    for (const user of users) {
      sendEmail(
        user.email,
        `🆕 New Blog Post in ${category}!`,
        template({ title, category, link: readLinkFor(user.type) })
      );
    }
  } catch (error) {
    console.error("Error sending blog notification emails:", error);
  }
};

export default notifyUsersAboutNewBlog;
