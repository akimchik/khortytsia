/**
 * @fileoverview This Cloud Function is the final stage of the pipeline (Module 6: Delivery).
 * It takes a fully verified and approved analysis and delivers it as a real-time alert
 * to a specified webhook, for platforms like Slack or Microsoft Teams.
 */

const axios = require('axios');

/**
 * A Pub/Sub-triggered Cloud Function that sends a verified lead as a rich alert to a webhook.
 * 
 * This function is triggered by a message on the 'final-leads' topic. It expects a JSON payload
 * containing the final, approved analysis. The function then formats this data into a human-readable,
 * rich message using Slack's Block Kit format and POSTs it to the webhook URL defined in the
 * `WEBHOOK_URL` environment variable.
 *
 * @param {Object} message The Pub/Sub message, containing the base64-encoded data.
 * @param {string} message.data The base64-encoded JSON string with the final lead data.
 * @param {Object} context The event metadata provided by Google Cloud Functions.
 */
exports.deliverAlert = async (message, context) => {
  try {
    const lead = JSON.parse(Buffer.from(message.data, 'base64').toString());

    // This message is formatted using Slack's Block Kit API for rich notifications.
    // It can be easily adapted for other platforms like Microsoft Teams.
    const formattedMessage = {
      text: `🔥 New Opportunity Hunted: ${lead.companyName}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚀 ${lead.companyName}`,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Industry:*\n${lead.industry}` },
            { type: 'mrkdwn', text: `*Region:*\n${lead.region}` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Opportunity:* ${lead.summary}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Potential Needs:*\n• ${lead.potentialNeed.join('\n• ')}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Source: <${lead.sourceURL}|Click to view>`,
            },
            {
              type: 'mrkdwn',
              text: ` | Confidence: *${lead.verification.confidenceScore}%*`,
            },
          ],
        },
      ],
    };

    // The webhook URL is stored as an environment variable for security and flexibility.
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('FATAL: WEBHOOK_URL environment variable not set.');
      return;
    }

    await axios.post(webhookUrl, formattedMessage);
    console.log(`Successfully delivered alert for ${lead.companyName}.`);

  } catch (error) {
    console.error(`Error delivering alert: ${error.message}`);
  }
};
