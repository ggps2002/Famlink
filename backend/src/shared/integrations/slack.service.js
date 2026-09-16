import axios from "axios";

// This function acts as the "Messenger". It takes the lead data we saved
// and forwards it to the correct Slack channel.
export const sendLeadToSlack = async (lead) => {
  try {
    // 1. Pick the correct Webhook URL based on where the lead came from
    let webhookUrl = "";
    switch (lead.source) {
      case "FB": webhookUrl = process.env.SLACK_WEBHOOK_FB_GROUPS; break;
      case "Craigslist": webhookUrl = process.env.SLACK_WEBHOOK_CRAIGSLIST; break;
      case "Nextdoor": webhookUrl = process.env.SLACK_WEBHOOK_NEXTDOOR; break;
      case "BPN": webhookUrl = process.env.SLACK_WEBHOOK_BPN; break;
      case "Peanut": webhookUrl = process.env.SLACK_WEBHOOK_PEANUT; break;
      default: console.error("Unknown lead source:", lead.source); return;
    }

    // If the URL is missing from the .env file, we stop here to prevent a crash
    if (!webhookUrl) {
      console.error(`Slack webhook URL missing for source: ${lead.source}`);
      return;
    }

    // Build Emoji for Temperature
    let tempEmoji = "🧊";
    if (lead.leadTemperature && lead.leadTemperature.toUpperCase().includes("HOT")) tempEmoji = "🔥";
    if (lead.leadTemperature && lead.leadTemperature.toUpperCase().includes("WARM")) tempEmoji = "☀️";

    // Build Emoji for Priority Tier
    let priorityEmoji = "⭐";
    if (lead.priorityTier && lead.priorityTier.includes("1")) priorityEmoji = "🚨 TIER 1 (CONTACT FIRST)";
    else if (lead.priorityTier && lead.priorityTier.includes("2")) priorityEmoji = "🌟 TIER 2 (STRONG)";
    else if (lead.priorityTier && lead.priorityTier.includes("3")) priorityEmoji = "🌱 TIER 3 (FUTURE)";
    else if (lead.priorityTier && lead.priorityTier.includes("4")) priorityEmoji = "👀 TIER 4 (WEAK)";
    else if (lead.priorityTier) priorityEmoji = lead.priorityTier;

    // Build Location Text
    let locationText = lead.city ? `${lead.city}` : (lead.zone || "Unknown");
    if (lead.locationStatus === "OUT_OF_ZONE_FUTURE") {
      locationText += " 🌍 (Future Expansion Waitlist)";
    } else if (lead.locationStatus === "IN_ZONE") {
      locationText += " 📍 (In-Zone)";
    }

    let markdownText = `*New ${lead.source} Lead Detected!*\n\n*Priority:* ${priorityEmoji}\n*Temperature:* ${tempEmoji} ${lead.leadTemperature || 'N/A'}\n*Lead Type:* ${lead.leadType || lead.userType || 'N/A'}\n*Potential Share:* ${lead.potentialShareType || 'N/A'}\n*Location:* ${locationText}\n*Urgency:* ${lead.urgency || 'N/A'}\n*Conversion Path:* ${lead.conversionPath || 'N/A'}`;

    if (lead.incomingMessage) {
      markdownText += `\n\n*Message Received:*\n💬 *"${lead.incomingMessage}"*`;
    }

    markdownText += `\n\n👉 <${lead.directLink}|Click here for Direct Link>`;

    // Format the rich Slack message
    const slackMessage = {
      text: "New Lead Detected!", // Fallback text for notifications
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: markdownText
          }
        }
      ]
    };

    // 5. Send the message to Slack using axios
    await axios.post(webhookUrl, slackMessage);
    console.log(`Successfully sent ${lead.source} lead to Slack!`);
  } catch (error) {
    console.error("Failed to send message to Slack:", error.message);
  }
};
