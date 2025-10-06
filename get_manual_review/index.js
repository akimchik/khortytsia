/**
 * @fileoverview This Cloud Function provides an HTTP endpoint to retrieve AI analyses
 * that have been flagged for manual review.
 * 
 * @warning This function as currently written has a major architectural flaw and will not work
 * reliably in a real serverless environment. See detailed comments below.
 */

const { PubSub } = require('@google-cloud/pubsub');

const pubsub = new PubSub();
const subscriptionName = 'final-analysis-manual-review-sub';

/**
 * @important_architectural_note
 * The use of a global variable `manualReviewAnalyses` to store state is not a viable
 * approach for a serverless function. Serverless environments are stateless. This means:
 * 1. Multiple Instances: If your function scales to more than one instance, each instance
 *    will have its own separate, empty `manualReviewAnalyses` array. They do not share memory.
 * 2. Ephemeral State: Function instances are spun down when not in use, and this array will be lost.
 * 3. Unreliable Subscription: Defining a Pub/Sub subscriber in the global scope like this can lead
 *    to unpredictable behavior, including duplicate message processing or missed messages.
 * 
 * @recommendation
 * The correct implementation would be:
 * 1. The `decision_engine` should write any analysis marked for 'Manual Review' to a persistent
 *    database, such as Google Firestore.
 * 2. This `getManualReview` function should then query that Firestore collection to retrieve the
 *    list of items needing review. This ensures a stateless, scalable, and reliable design.
 */
let manualReviewAnalyses = [];

// This subscription in the global scope is problematic for the reasons mentioned above.
const subscription = pubsub.subscription(subscriptionName);
subscription.on('message', message => {
  const analysis = JSON.parse(message.data.toString());
  if (analysis.decision === 'Manual Review') {
    manualReviewAnalyses.push(analysis);
  }
  message.ack();
});

/**
 * An HTTP-triggered Cloud Function that gets the list of analyses flagged for manual review.
 * 
 * NOTE: Due to the architectural issues described above, this function will likely return an
 * empty array or an incomplete list in a real deployment.
 *
 * @param {Object} req The Express-style request object.
 * @param {Object} res The Express-style response object.
 */
exports.getManualReview = (req, res) => {
  res.status(200).json(manualReviewAnalyses);
};
