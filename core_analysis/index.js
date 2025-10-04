
const { PubSub } = require('@google-cloud/pubsub');
const { VertexAI } = require('@google-cloud/vertexai');
const Joi = require('joi');
const fs = require('fs').promises;

const pubsub = new PubSub();
const vertexai = new VertexAI({ project: process.env.GCLOUD_PROJECT, location: 'us-central1' });

const externalVerificationTopic = 'external-verification';
const internalQcTopic = 'internal-qc';

let promptTemplate = null;

async function getPromptTemplate() {
  if (promptTemplate) {
    return promptTemplate;
  }
  promptTemplate = await fs.readFile('prompt.txt', 'utf-8');
  return promptTemplate;
}

const articleSchema = Joi.object({
  clean_text: Joi.string().required(),
  source_url: Joi.string().uri().required(),
  source_domain: Joi.string().required(),
});

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
 * Pub/Sub-triggered Cloud Function that analyzes article content.
 *
 * @param {Object} message The Pub/Sub message.
 * @param {Object} context The event metadata.
 */
exports.coreAnalysis = async (message, context) => {
  try {
    const article = JSON.parse(Buffer.from(message.data, 'base64').toString());
    const { error } = articleSchema.validate(article);
    if (error) {
      console.error(`Invalid article format: ${error.message}`);
      return;
    }

    const promptTemplate = await getPromptTemplate();
    const finalPrompt = promptTemplate.replace('{{ARTICLE_TEXT}}', article.clean_text);

    const generativeModel = exports.vertexai.preview.getGenerativeModel({
      model: 'gemini-2.5-pro',
    });

    const result = await generativeModel.generateContent({ contents: [{ role: 'user', parts: [{ text: finalPrompt }] }] });
    const analysisText = result.response.candidates[0].content.parts[0].text;

    const analysis = JSON.parse(analysisText);
    const { error: analysisError } = analysisSchema.validate(analysis);
    if (analysisError) {
      console.error(`Invalid analysis format: ${analysisError.message}`);
      // Here you could implement a retry mechanism or send to a dead-letter queue
      return;
    }

    const analysisMessage = { json: analysis };

    await Promise.all([
      exports.pubsub.topic(externalVerificationTopic).publishMessage(analysisMessage),
      exports.pubsub.topic(internalQcTopic).publishMessage(analysisMessage),
    ]);

    console.log(`Published analysis for ${analysis.companyName} to verification topics.`);

  } catch (error) {
    console.error(`Error in coreAnalysis: ${error.message}`);
  }
};

exports.pubsub = pubsub;
exports.vertexai = vertexai;
