
const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();
const topicName = 'source-to-fetch';

// Mock configuration store
const dataSources = [
  { source_url: 'https://api.example.com/news', source_type: 'API' },
  { source_url: 'https://news.example.com/latest', source_type: 'Scrape' },
  { source_url: 'https://another-api.com/v1/articles', source_type: 'API' },
];

/**
 * HTTP-triggered Cloud Function that kicks off the data ingestion process.
 *
 * @param {Object} req Cloud Functions request context.
 * @param {Object} res Cloud Functions response context.
 */
exports.triggerIngestionCycle = async (req, res) => {
  try {
    for (const source of dataSources) {
      const message = {
        json: source,
      };
      await exports.pubsub.topic(topicName).publishMessage(message);
      console.log(`Published message to ${topicName}: ${JSON.stringify(source)}`);
    }
    res.status(200).send('Ingestion cycle triggered successfully.');
  } catch (error) {
    console.error(`Error in triggerIngestionCycle: ${error.message}`);
    res.status(500).send('Error triggering ingestion cycle.');
  }
};

exports.pubsub = pubsub;
