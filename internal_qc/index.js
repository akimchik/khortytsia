
const { PubSub } = require('@google-cloud/pubsub');
const Joi = require('joi');

const pubsub = new PubSub();
const decisionEngineTopic = 'decision-engine-queue';

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

function logicalConsistencyValidator(analysis) {
  if (analysis.summary.toLowerCase().includes('expansion') && analysis.opportunityType === 'Downsizing') {
    return 'Failed';
  }
  return 'Passed';
}

function sentimentAndToneAnalyzer(analysis) {
  // In a real implementation, this would use a sentiment analysis model
  console.log('Simulating sentiment and tone analysis...');
  return 'Passed';
}

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
 * Pub/Sub-triggered Cloud Function that performs internal QC.
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

    const failedRules = businessRuleEngine(analysis);
    const logicalConsistency = logicalConsistencyValidator(analysis);
    const toneAnalysis = sentimentAndToneAnalyzer(analysis);
    const qualityScore = qcScoreCalculation(failedRules, logicalConsistency, toneAnalysis);

    const enrichedAnalysis = {
      ...analysis,
      internal_qc: {
        qualityScore,
        rulesPassed: 20 - failedRules.length, // Assuming 20 rules in total
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
