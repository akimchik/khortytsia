
const { PubSub } = require('@google-cloud/pubsub');
const Joi = require('joi');

const pubsub = new PubSub();
const finalAnalysisTopic = 'final-analysis';

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
 * HTTP-triggered Cloud Function that makes a final decision on the analysis.
 *
 * @param {Object} req The Express request object.
 * @param {Object} res The Express response object.
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

    const finalMessage = { json: finalAnalysis };
    await pubsub.topic(finalAnalysisTopic).publishMessage(finalMessage);

    console.log(`Published final analysis for ${analysis.companyName} with decision: ${decision}`);
    res.status(200).send(`Published final analysis for ${analysis.companyName} with decision: ${decision}`);

  } catch (error) {
    console.error(`Error in decisionEngine: ${error.message}`);
    res.status(500).send(`Error in decisionEngine: ${error.message}`);
  }
};
