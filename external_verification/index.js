/**
 * @fileoverview This Cloud Function performs external verification on the AI-generated analysis.
 * It acts as a fact-checker, attempting to verify the claims made in the analysis against
 * external sources. It is triggered as part of a parallel workflow.
 */

const { PubSub } = require('@google-cloud/pubsub');
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
const Joi = require('joi');

const pubsub = new PubSub();
const auth = new GoogleAuth();

const decisionEngineTopic = 'decision-engine-queue';

// In a real system, these would be managed in a database or a dedicated configuration service.
const domainWhitelist = ['reuters.com', 'bloomberg.com'];
const domainBlacklist = ['my-sensational-blog.net'];

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
 * Assesses the reputation of a news source domain.
 * @param {string} sourceDomain The domain of the news source (e.g., 'reuters.com').
 * @returns {Promise<number>} A promise that resolves to a reputation score (0-100).
 */
async function sourceVetting(sourceDomain) {
  if (domainWhitelist.includes(sourceDomain)) {
    return 100;
  }
  if (domainBlacklist.includes(sourceDomain)) {
    return 0;
  }
  // In a real implementation, this would call a media reputation API like NewsGuard.
  console.log(`Simulating media reputation API call for ${sourceDomain}`);
  return 85;
}

/**
 * Extracts key, verifiable facts from the AI analysis.
 * @param {Object} analysis The AI-generated analysis object.
 * @returns {Promise<Object>} A promise that resolves to an object of extracted facts.
 */
async function factExtraction(analysis) {
  // In a real implementation, this would be more sophisticated, potentially using another AI model
  // or advanced NLP techniques to identify the most critical and verifiable claims.
  return {
    companyName: analysis.companyName,
    investment: analysis.summary.match(/\$[0-9]+M/)?.[0], // Simple regex to find an investment figure.
    region: analysis.region,
  };
}

/**
 * Attempts to find corroborating sources for the extracted facts.
 * @param {Object} facts An object of facts to verify.
 * @returns {Promise<Object>} A promise that resolves to an object containing the triangulation results.
 */
async function triangulation(facts) {
  // In a real implementation, this would use a Search API (e.g., Google Custom Search) to find
  // other articles from whitelisted sources that mention the same facts.
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

/**
 * Calculates a final confidence score based on the verification steps.
 * @param {number} sourceReputation The reputation score of the source.
 * @param {Object} triangulationResult The result of the triangulation step.
 * @returns {number} The final confidence score (0-100).
 */
function scoreCalculation(sourceReputation, triangulationResult) {
  // This is a placeholder for what would be a more sophisticated, weighted algorithm.
  return Math.round((sourceReputation * 0.5) + (triangulationResult.corroboratingSources * 10 * 0.5));
}

/**
 * A Pub/Sub-triggered Cloud Function that verifies the AI-generated article analysis.
 * 
 * This function takes the analysis, vets the source, extracts key facts, attempts to triangulate
 * those facts with external sources, and calculates a final confidence score. It then enriches
 * the original analysis with this verification data and forwards it to the decision engine.
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

    // Perform the verification steps.
    const sourceReputation = await sourceVetting(new URL(analysis.sourceURL).hostname);
    const facts = await factExtraction(analysis);
    const triangulationResult = await triangulation(facts);
    const confidenceScore = scoreCalculation(sourceReputation, triangulationResult);

    // Enrich the original analysis with the new verification data.
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

// Export the pubsub client for easier testing and mocking.
exports.pubsub = pubsub;
