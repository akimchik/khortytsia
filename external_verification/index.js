
const { PubSub } = require('@google-cloud/pubsub');
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
const Joi = require('joi');

const pubsub = new PubSub();
const auth = new GoogleAuth();

const decisionEngineTopic = 'decision-engine-queue';

const domainWhitelist = ['reuters.com', 'bloomberg.com'];
const domainBlacklist = ['my-sensational-blog.net'];

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

async function sourceVetting(sourceDomain) {
  if (domainWhitelist.includes(sourceDomain)) {
    return 100;
  }
  if (domainBlacklist.includes(sourceDomain)) {
    return 0;
  }
  // In a real implementation, this would call a media reputation API
  console.log(`Simulating media reputation API call for ${sourceDomain}`);
  return 85;
}

async function factExtraction(analysis) {
  // In a real implementation, this would be more sophisticated
  return {
    companyName: analysis.companyName,
    investment: analysis.summary.match(/\$[0-9]+M/)?.[0],
    region: analysis.region,
  };
}

async function triangulation(facts) {
  // In a real implementation, this would call a Search API
  console.log(`Simulating search API call for facts: ${JSON.stringify(facts)}`);
  return {
    corroboratingSources: 3,
    corroboratingUrls: [
      'https://trusted-source-1.com/article-A',
      'https://trusted-source-2.com/article-B',
      'https://trusted-source-3.com/article-C',
    ],
  };
}

function scoreCalculation(sourceReputation, triangulationResult) {
  // In a real implementation, this would be a more sophisticated algorithm
  return Math.round((sourceReputation * 0.5) + (triangulationResult.corroboratingSources * 10 * 0.5));
}

/**
 * Pub/Sub-triggered Cloud Function that verifies article analysis.
 *
 * @param {Object} message The Pub/Sub message.
 * @param {Object} context The event metadata.
 */
exports.externalVerification = async (message, context) => {
  try {
    const analysis = JSON.parse(Buffer.from(message.data, 'base64').toString());
    const { error } = analysisSchema.validate(analysis);
    if (error) {
      console.error(`Invalid analysis format: ${error.message}`);
      return;
    }

    const sourceReputation = await sourceVetting(new URL(analysis.sourceURL).hostname);
    const facts = await factExtraction(analysis);
    const triangulationResult = await triangulation(facts);
    const confidenceScore = scoreCalculation(sourceReputation, triangulationResult);

    const enrichedAnalysis = {
      ...analysis,
      verification: {
        confidenceScore,
        sourceReputationScore: sourceReputation,
        corroboratingSources: triangulationResult.corroboratingSources,
        corroboratingUrls: triangulationResult.corroboratingUrls,
        lastCheckedTimestamp: new Date().toISOString(),
      },
    };

    const enrichedMessage = { json: enrichedAnalysis };
    await exports.pubsub.topic(decisionEngineTopic).publishMessage(enrichedMessage);

    console.log(`Published verified analysis for ${analysis.companyName} to decision engine.`);

  } catch (error) {
    console.error(`Error in externalVerification: ${error.message}`);
  }
};

exports.pubsub = pubsub;
