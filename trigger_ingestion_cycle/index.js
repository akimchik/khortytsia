/**
 * @fileoverview This Cloud Function serves as the entry point for the entire Khortytsia pipeline.
 * It is designed to be triggered by an HTTP request, typically from a service like Google Cloud Scheduler,
 * to initiate the data ingestion process at regular intervals.
 */

const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();
const topicName = 'source-to-fetch';

const dataSources = require('./data-sources.json');
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
