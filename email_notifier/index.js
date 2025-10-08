/**
 * @fileoverview This Cloud Function is triggered by a Pub/Sub message and sends an
 * email notification using the Gmail API.
 */

const { google } = require('googleapis');

/**
 * Pub/Sub-triggered Cloud Function that sends an email for a new manual review item.
 *
 * @param {object} pubSubEvent The Pub/Sub event payload.
 * @param {object} context The event metadata.
 */
exports.emailNotifier = async (pubSubEvent, context) => {
    const triggerResource = context.resource;
    console.log(`Function triggered by event on: ${triggerResource}`);

    const pubSubData = JSON.parse(Buffer.from(pubSubEvent.data, 'base64').toString());
    const { companyName, summary } = pubSubData;

    console.log(`New analysis for ${companyName} requires review.`);

    const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
    });
    const authClient = await auth.getClient();
    google.options({ auth: authClient });

    const gmail = google.gmail('v1');

    const to = process.env.EMAIL_TO;
    const from = process.env.EMAIL_FROM;
    const subject = `New Article for Manual Review: ${companyName}`;
    const messageBody = `
        <p>A new article has been flagged for manual review.</p>
        <h3>${companyName}</h3>
        <p><strong>Summary:</strong> ${summary}</p>
        <p>Please visit the manual review interface to approve or decline this item.</p>
    `;

    const rawMessage = [
        `From: ${from}`,
        `To: ${to}`,
        `Content-Type: text/html; charset=utf-8`,
        `MIME-Version: 1.0`,
        `Subject: ${subject}`,
        '',
        messageBody
    ].join('\n');

    const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    try {
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });
        console.log(`Notification email sent successfully to ${to}.`);
    } catch (error) {
        console.error(`Error sending email via Gmail API: ${error.message}`);
    }
};
