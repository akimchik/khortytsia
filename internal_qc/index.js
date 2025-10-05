/**
 * @fileoverview This Cloud Function performs internal quality control on the AI-generated analysis.
 * It does not check external facts, but rather evaluates the quality, consistency, and adherence
 * to business rules of the AI's output itself. It is triggered as part of a parallel workflow.
 */

const { PubSub } = require('@google-cloud/pubsub');
const Joi = require('joi');

const pubsub = new PubSub();
const decisionEngineTopic = 'decision-engine-queue';

// Joi schema for validating the structure of the incoming analysis data.
const analysisSchema = Joi.object({
  companyName: Joi.string().required(),
  industry: Joi.string().required(),
  region: Joi.string().required(),
  opportunityType: Joi.string().required(),
  summary: Joi.string().required(),
  potentialNeed: Joi.array().items(Joi.string()).required(),
  opportunityScore: Joi.number().integer().min(1).max(10).required(),
  keyQuote: Joi.string().required(),
  sourceURL: Joi.string().uri().required(),
});

/**
 * Checks the analysis against a predefined set of business rules.
 * @param {Object} analysis The AI-generated analysis object.
 * @returns {string[]} An array of strings, where each string is a description of a failed rule.
 */
function businessRuleEngine(analysis) {
  const failedRules = [];
  if (analysis.opportunityType === 'New Construction' && !analysis.potentialNeed.includes('Construction Services')) {
    failedRules.push('If opportunityType is \'New Construction\', then potentialNeed must include \'Construction Services\'.');
  }
  if (analysis.industry === 'Technology' && analysis.opportunityScore <= 7) {
    failedRules.push('The opportunityScore must be greater than 7 if the industry is \'Technology\'.');
  }
  if (analysis.summary.length < 50) {
    failedRules.push('The summary must be at least 50 characters long.');
  }
  return failedRules;
}

/**
 * Checks for logical contradictions within the analysis.
 * @param {Object} analysis The AI-generated analysis object.
 * @returns {string} 'Passed' or 'Failed'.
 */
function logicalConsistencyValidator(analysis) {
  // This is a simple example. A real implementation could be much more complex,
  // potentially using another AI model to check for subtle contradictions.
  if (analysis.summary.toLowerCase().includes('expansion') && analysis.opportunityType === 'Downsizing') {
    return 'Failed';
  }
  return 'Passed';
}

/**
 * Simulates analyzing the sentiment and tone of the analysis summary.
 * @param {Object} analysis The AI-generated analysis object.
 * @returns {string} 'Passed' or 'Failed'.
 */
function sentimentAndToneAnalyzer(analysis) {
  // In a real implementation, this would use a sentiment analysis model (e.g., from Google's NLP API)
  // to ensure the tone is objective and professional.
  console.log('Simulating sentiment and tone analysis...');
  return 'Passed';
}

/**
 * Calculates a final quality score based on the QC checks.
 * @param {string[]} failedRules An array of failed business rules.
 * @param {string} logicalConsistency The result of the consistency check.
 * @param {string} toneAnalysis The result of the tone analysis.
 * @returns {number} The final quality score (0-100).
 */
function qcScoreCalculation(failedRules, logicalConsistency, toneAnalysis) {
  let score = 100;
  score -= failedRules.length * 10;
  if (logicalConsistency === 'Failed') {
    score -= 20;
  }
  if (toneAnalysis === 'Failed') {
    score -= 10;
  }
  return Math.max(0, score);
}

/**
 * A Pub/Sub-triggered Cloud Function that performs internal quality control on an AI analysis.
 * 
 * This function validates the analysis against a series of internal checks:
 * 1. A business rule engine.
 * 2. A logical consistency validator.
 * 3. A sentiment and tone analyzer.
 * It then calculates a `qualityScore` and enriches the original analysis with this QC data
 * before publishing it to the decision engine.
 *
 * @param {Object} message The Pub/Sub message.
 * @param {Object} context The event metadata.
 */
exports.internalQc = async (message, context) => {
  try {
    const analysis = JSON.parse(Buffer.from(message.data, 'base64').toString());
    const { error } = analysisSchema.validate(analysis);
    if (error) {
      console.error(`Invalid analysis format: ${error.message}`);
      return;
    }

    // Perform the QC checks.
    const failedRules = businessRuleEngine(analysis);
    const logicalConsistency = logicalConsistencyValidator(analysis);
    const toneAnalysis = sentimentAndToneAnalyzer(analysis);
    const qualityScore = qcScoreCalculation(failedRules, logicalConsistency, toneAnalysis);

    // Enrich the original analysis with the new QC data.
    const enrichedAnalysis = {
      ...analysis,
      internal_qc: {
        qualityScore,
        rulesPassed: 20 - failedRules.length, // Assuming 20 rules in total for this example
        rulesFailed: failedRules.length,
        failedRules,
        logicalConsistency,
        toneAnalysis,
        lastCheckedTimestamp: new Date().toISOString(),
      },
    };

    const enrichedMessage = { json: enrichedAnalysis };
    await pubsub.topic(decisionEngineTopic).publishMessage(enrichedMessage);

    console.log(`Published QC analysis for ${analysis.companyName} to decision engine.`);

  } catch (error) {
    console.error(`Error in internalQc: ${error.message}`);
  }
};
