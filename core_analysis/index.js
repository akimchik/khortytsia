/**
 * @fileoverview This Cloud Function is the analytical core of the pipeline.
 * It uses the Vertex AI Gemini Pro model to analyze article text and extract structured business insights.
 * It is triggered by a message on the 'article-to-analyze' Pub/Sub topic.
 */

const { PubSub } = require('@google-cloud/pubsub');
const { VertexAI } = require('@google-cloud/vertexai');
const { WorkflowsClient } = require('@google-cloud/workflows');
const Joi = require('joi');
const fs = require('fs').promises;

const pubsub = new PubSub();
const vertexai = new VertexAI({ project: process.env.GCLOUD_PROJECT, location: 'us-central1' });
const workflowsClient = new WorkflowsClient();

// A simple in-memory cache for the prompt template to avoid file reads on every invocation.
let promptTemplate = null;

/**
 * Loads the prompt template from a local file.
 * Implements an in-memory cache.
 * @returns {Promise<string>} A promise that resolves to the prompt template string.
 */
async function getPromptTemplate() {
  if (promptTemplate) {
    return promptTemplate;
  }
  // In a real-world scenario, consider fetching this from a more robust
  // configuration management system or a dedicated GCS bucket.
  promptTemplate = await fs.readFile('prompt.txt', 'utf-8');
  return promptTemplate;
}

// Joi schema for validating the structure of the incoming article data.
const articleSchema = Joi.object({
  clean_text: Joi.string().required(),
  source_url: Joi.string().uri().required(),
  source_domain: Joi.string().required(),
});

// Joi schema for validating the structure of the JSON output from the Gemini model.
// This acts as a critical data integrity check.
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
 * A Pub/Sub-triggered Cloud Function that performs the core AI analysis on an article.
 * 
 * This function receives an article's content, validates it, and then uses the Vertex AI Gemini Pro model
 * to extract structured insights based on a predefined prompt template. The AI's output is also validated
 * against a schema. If successful, it triggers the 'khortytsia-workflow' to perform parallel
 * external and internal verification steps.
 *
 * @param {Object} message The Pub/Sub message, containing the base64-encoded data.
 * @param {string} message.data The base64-encoded JSON string with the clean article text.
 * @param {Object} context The event metadata provided by Google Cloud Functions.
 */
exports.coreAnalysis = async (message, context) => {
  try {
    // 1. Decode and validate the incoming article data.
    const article = JSON.parse(Buffer.from(message.data, 'base64').toString());
    const { error } = articleSchema.validate(article);
    if (error) {
      console.error(`Invalid article format: ${error.message}`);
      return; // Stop execution if the input is invalid.
    }

    // 2. Prepare the prompt for the AI model.
    const promptTemplate = await getPromptTemplate();
    const finalPrompt = promptTemplate.replace('{{ARTICLE_TEXT}}', article.clean_text);

    // 3. Call the Gemini Pro model.
    const generativeModel = vertexai.preview.getGenerativeModel({
      model: 'gemini-2.5-pro',
    });
    const result = await generativeModel.generateContent({ contents: [{ role: 'user', parts: [{ text: finalPrompt }] }] });
    const analysisText = result.response.candidates[0].content.parts[0].text;

    // 4. Parse and validate the AI's response.
    const analysis = JSON.parse(analysisText);
    const { error: analysisError } = analysisSchema.validate(analysis);
    if (analysisError) {
      console.error(`Invalid analysis format from AI: ${analysisError.message}`);
      // In a production system, this might trigger a retry or be sent to a dead-letter queue.
      return;
    }

    // 5. Trigger the verification workflow.
    // This workflow will run the external_verification and internal_qc functions in parallel.
    const execution = await workflowsClient.createExecution({
      parent: workflowsClient.workflowPath(process.env.GCLOUD_PROJECT, 'us-central1', 'khortytsia-workflow'),
      execution: {
        // The argument must be a stringified JSON object.
        argument: JSON.stringify({ data: { message: { data: Buffer.from(JSON.stringify(analysis)).toString('base64') } } })
      }
    });

    console.log(`Triggered workflow for ${analysis.companyName}. Execution: ${execution[0].name}`);

  } catch (error) {
    console.error(`Error in coreAnalysis: ${error.message}`);
  }
};
