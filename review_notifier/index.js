/**
 * @fileoverview This Cloud Function is triggered by the creation of a new document
 * in the 'manual-review-queue' Firestore collection. It sends an email notification using SendGrid.
 */

const sgMail = require('@sendgrid/mail');

// Set the SendGrid API key from environment variables.
// You must configure this in your Terraform file.
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Firestore-triggered Cloud Function that sends an email for a new manual review item.
 *
 * @param {object} event The Cloud Functions event payload.
 * @param {object} context The event metadata.
 */
exports.reviewNotifier = async (event, context) => {
    const triggerResource = context.resource;
    console.log(`Function triggered by event on: ${triggerResource}`);

    const newAnalysis = event.value.fields;
    const companyName = newAnalysis.companyName.stringValue;
    const summary = newAnalysis.summary.stringValue;
    const docId = context.params.docId;

    console.log(`New analysis for ${companyName} (ID: ${docId}) requires review.`);

    const msg = {
        to: process.env.EMAIL_TO, // The recipient email address.
        from: process.env.EMAIL_FROM, // Your verified sender email address in SendGrid.
        subject: `New Article for Manual Review: ${companyName}`,
        html: `
            <p>A new article has been flagged for manual review.</p>
            <h3>${companyName}</h3>
            <p><strong>Summary:</strong> ${summary}</p>
            <p>Please visit the manual review interface to approve or decline this item.</p>
            <p><em>Document ID: ${docId}</em></p>
        `,
    };

    try {
        await sgMail.send(msg);
        console.log(`Notification email sent successfully to ${process.env.EMAIL_TO}.`);
    } catch (error) {
        console.error(`Error sending email with SendGrid: ${error.message}`);
        if (error.response) {
            console.error(error.response.body);
        }
    }
};