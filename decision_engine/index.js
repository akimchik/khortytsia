/**
 * @fileoverview This Cloud Function acts as the central decision-making hub of the pipeline.
 * It synthesizes the results from the external verification and internal quality control modules
 * to make a final judgment on the AI-generated analysis.
 */

const { PubSub } = require('@google-cloud/pubsub');
const { Firestore } = require('@google-cloud/firestore');
const Joi = require('joi');

const pubsub = new PubSub();
const firestore = new Firestore();
const finalAnalysisTopic = 'final-analysis';
const manualReviewCollection = 'manual-review-queue';
const reviewNotificationTopic = 'review-notifications';

const enrichedAnalysisSchema = Joi.object({
  companyName: Joi.string().required(),
  industry: Joi.string().required(),
  region: Joi.string().required(),
  opportunityType: Joi.string().required(),
  summary: Joi.string().required(),
  potentialNeed: Joi.array().items(Joi.string()).required(),
  opportunityScore: Joi.number().integer().min(1).max(10).required(),
  keyQuote: Joi.string().required(),
  sourceURL: Joi.string().uri().required(),
  verification: Joi.object().required(),
  internal_qc: Joi.object().required(),
});

function decisionMatrix(analysis) {
  if (analysis.verification.confidenceScore > 90 && analysis.internal_qc.qualityScore > 90) {
    return 'Approved';
  }
  if (analysis.verification.confidenceScore < 70 || analysis.internal_qc.qualityScore < 70) {
    return 'Rejected';
  }
  return 'Manual Review';
}

/**
 * An HTTP-triggered Cloud Function that makes a final decision on an AI analysis.
 */
exports.decisionEngine = async (req, res) => {
  try {
    const analysis = req.body;
    const { error } = enrichedAnalysisSchema.validate(analysis);
    if (error) {
      console.error(`Invalid enriched analysis format: ${error.message}`);
      res.status(400).send(`Invalid enriched analysis format: ${error.message}`);
      return;
    }

    const decision = decisionMatrix(analysis);

    const finalAnalysis = {
      ...analysis,
      decision,
      decisionTimestamp: new Date().toISOString(),
    };

    if (decision === 'Manual Review') {
      // If manual review is needed, save it to the Firestore queue instead of the final topic.
      const docRef = firestore.collection(manualReviewCollection).doc();
      await docRef.set(finalAnalysis);
      console.log(`Saved analysis for ${analysis.companyName} to manual review queue.`);

      // Write a structured log for the alerting policy to detect.
      const logEntry = {
        severity: 'INFO',
        message: `Manual review required for ${analysis.companyName}`,
        company: analysis.companyName,
        summary: analysis.summary,
        review_required: true // A specific field for the filter
      };
      console.log(JSON.stringify(logEntry));

      res.status(200).send(`Analysis for ${analysis.companyName} requires manual review.`);
    } else {
      // Otherwise, publish the final result for downstream consumers.
      const finalMessage = { json: finalAnalysis };
      await pubsub.topic(finalAnalysisTopic).publishMessage(finalMessage);
      console.log(`Published final analysis for ${analysis.companyName} with decision: ${decision}`);
      res.status(200).send(`Published final analysis for ${analysis.companyName} with decision: ${decision}`);
    }

  } catch (error) {
    console.error(`Error in decisionEngine: ${error.message}`);
    res.status(500).send(`Error in decisionEngine: ${error.message}`);
  }
};