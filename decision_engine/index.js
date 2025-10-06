/**
 * @fileoverview This Cloud Function acts as the central decision-making hub of the pipeline.
 * It synthesizes the results from the external verification and internal quality control modules
 * to make a final judgment on the AI-generated analysis.
 */

const { PubSub } = require('@google-cloud/pubsub');
const Joi = require('joi');

const pubsub = new PubSub();
// The topic for publishing the final, decided-upon analysis.
const finalAnalysisTopic = 'final-analysis';

// Joi schema for validating the fully enriched analysis object.
// This ensures that the data from both verification modules is present before making a decision.
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
  verification: Joi.object({
    confidenceScore: Joi.number().required(),
    sourceReputationScore: Joi.number().required(),
    corroboratingSources: Joi.number().required(),
    corroboratingUrls: Joi.array().items(Joi.string().uri()).required(),
    lastCheckedTimestamp: Joi.string().isoDate().required(),
  }).required(),
  internal_qc: Joi.object({
    qualityScore: Joi.number().required(),
    rulesPassed: Joi.number().required(),
    rulesFailed: Joi.number().required(),
    failedRules: Joi.array().items(Joi.string()).required(),
    logicalConsistency: Joi.string().required(),
    toneAnalysis: Joi.string().required(),
    lastCheckedTimestamp: Joi.string().isoDate().required(),
  }).required(),
});

/**
 * Applies a set of rules to the analysis scores to determine a final decision.
 * @param {Object} analysis The fully enriched analysis object.
 * @returns {string} The final decision: 'Approved', 'Rejected', or 'Manual Review'.
 */
function decisionMatrix(analysis) {
  // High confidence and high quality -> Automatic Approval
  if (analysis.verification.confidenceScore > 90 && analysis.internal_qc.qualityScore > 90) {
    return 'Approved';
  }
  // Low confidence or low quality -> Automatic Rejection
  if (analysis.verification.confidenceScore < 70 || analysis.internal_qc.qualityScore < 70) {
    return 'Rejected';
  }
  // Anything in between requires a human to look at it.
  return 'Manual Review';
}

/**
 * An HTTP-triggered Cloud Function that makes a final decision on an AI analysis.
 * 
 * This function receives the fully enriched analysis object, containing the original AI output
 * plus the data from the external verification and internal QC modules. It validates the object,
 * uses a decision matrix to approve, reject, or flag for manual review, and then publishes
 * the final result to the 'final-analysis' topic.
 *
 * @param {Object} req The Express-style request object.
 * @param {Object} req.body The fully enriched analysis object.
 * @param {Object} res The Express-style response object.
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

    // Determine the final outcome.
    const decision = decisionMatrix(analysis);

    const finalAnalysis = {
      ...analysis,
      decision,
      decisionTimestamp: new Date().toISOString(),
    };

    // Publish the final result for downstream consumers (e.g., alerting, dashboards).
    const finalMessage = { json: finalAnalysis };
    await pubsub.topic(finalAnalysisTopic).publishMessage(finalMessage);

    console.log(`Published final analysis for ${analysis.companyName} with decision: ${decision}`);
    res.status(200).send(`Published final analysis for ${analysis.companyName} with decision: ${decision}`);

  } catch (error) {
    console.error(`Error in decisionEngine: ${error.message}`);
    res.status(500).send(`Error in decisionEngine: ${error.message}`);
  }
};
