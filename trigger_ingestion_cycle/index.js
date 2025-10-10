/**
 * @fileoverview This Cloud Function serves as the entry point for the entire Khortytsia pipeline.
 * It is designed to be triggered by an HTTP request, typically from a service like Google Cloud Scheduler,
 * to initiate the data ingestion process at regular intervals.
 */

const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();
const topicName = 'source-to-fetch';

// In a production environment, this list would likely be stored in a database or a configuration file.
// TODO: Move dataSources to a managed database or configuration service
const dataSources = [
  // News & Trend Websites (for scraping)
  { source_url: 'https://www.bloomberg.com/', source_type: 'Scrape' },
  { source_url: 'https://techcrunch.com/', source_type: 'Scrape' },
  { source_url: 'https://www.wired.com/', source_type: 'Scrape' },
  { source_url: 'https://hbr.org/', source_type: 'Scrape' },
  { source_url: 'https://www.forbes.com/', source_type: 'Scrape' },
  { source_url: 'https://www.wsj.com/', source_type: 'Scrape' },
  { source_url: 'https://www.trendhunter.com/', source_type: 'Scrape' },
  { source_url: 'https://explodingtopics.com/', source_type: 'Scrape' },
  { source_url: 'https://www.wipo.int/global_innovation_index/en/', source_type: 'Scrape' },
  // APIs (for direct data goodness)
  { source_url: 'https://site.financialmodelingprep.com/developer/docs', source_type: 'API' },
  { source_url: 'https://www.cognism.com/api', source_type: 'API' },
  { source_url: 'https://coresignal.com/developers/api-documentation', source_type: 'API' },
  { source_url: 'https://platform.openai.com/docs/api-reference', source_type: 'API' },
  { source_url: 'https://cloud.google.com/apis/docs/overview', source_type: 'API' }
];
/**
 * An HTTP-triggered Cloud Function that kicks off the data ingestion process.
 *
 * This function iterates through a predefined list of data sources (APIs, websites to scrape, etc.)
 * and publishes a message for each one to the 'source-to-fetch' Pub/Sub topic.
 * Each message contains the information needed for the next stage of the pipeline to fetch the data.
 *
 * @param {Object} req The Express-style request object, provided by Google Cloud Functions.
 * @param {Object} res The Express-style response object, provided by Google Cloud Functions.
 */
exports.triggerIngestionCycle = async (req, res) => {
  try {
    // Loop through each configured data source.
    for (const source of dataSources) {
      const message = {
        json: source, // The data payload for the Pub/Sub message.
      };

      // Publish the message to the Pub/Sub topic to trigger the next function in the pipeline.
      await exports.pubsub.topic(topicName).publishMessage(message);
      console.log(`Published message to ${topicName}: ${JSON.stringify(source)}`);
    }
    res.status(200).send('Ingestion cycle triggered successfully.');
  } catch (error) {
    console.error(`Error in triggerIngestionCycle: ${error.message}`);
    res.status(500).send('Error triggering ingestion cycle.');
  }
};

// Export the pubsub client for easier testing and mocking.
exports.pubsub = pubsub;
