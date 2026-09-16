// The newsletter opt-in email and the two pages its link can land on.
//
// These are full HTML documents rather than application routes because they are
// opened from a mail client: there is no app around them to render a result
// into, and a redirect into the SPA would lose the outcome on the way.

const shell = (content) => `
  <div style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
    <div style="max-width: 500px; background: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); text-align: center;">
      ${content}
    </div>
  </div>
`;

const button = (href, label, colour) => `
      <a href="${href}"
         style="display: inline-block; margin-top: 20px; padding: 12px 24px; background-color: ${colour}; color: #fff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">
        ${label}
      </a>
`;

export const confirmationEmail = (confirmUrl) => ({
  subject: "Please confirm your email",
  html: `
  <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; text-align: center;">
    <div style="max-width: 500px; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
      <h2 style="color: #4A90E2; font-size: 22px; margin-bottom: 10px;">📩 Confirm Your Subscription</h2>
      <p style="font-size: 16px; color: #333;">Thanks for joining our newsletter! Please confirm your email to start receiving updates.</p>
      <div style="margin: 25px 0;">
        <a href="${confirmUrl}"
           style="background-color: #4A90E2; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: bold;">
          Confirm Email
        </a>
      </div>
      <p style="font-size: 14px; color: #666;">This link will expire in 1 hour. If you didn't subscribe, you can safely ignore this email.</p>
    </div>
  </div>
`,
});

export const confirmedPage = (frontendUrl) =>
  shell(`
      <h2 style="color: #4A90E2;">🎉 Subscription Confirmed</h2>
      <p style="font-size: 16px; color: #333;">Thank you for verifying your email. You are now subscribed to our newsletter and will start receiving updates soon.</p>
      ${button(frontendUrl, "Go to Famlink", "#4A90E2")}
`);

// Deliberately vague about which failure this was. An expired link, a forged
// one and an address already on the list are not distinguishable to the reader,
// and telling them apart would let this page confirm whether an address is
// subscribed.
export const failedPage = (frontendUrl) =>
  shell(`
      <h2 style="color: #ff6b6b;">❌ Verification Failed</h2>
      <p style="font-size: 16px; color: #333;">The verification link is invalid or has expired.</p>
      ${button(frontendUrl, "Try Again", "#ff6b6b")}
`);
