
const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();
const topicName = 'article-to-filter';

/**
 * Pub/Sub-triggered Cloud Function that fetches data from a source.
 *
 * @param {Object} message The Pub/Sub message.
 * @param {Object} context The event metadata.
 */
exports.fetchSourceData = async (message, context) => {
  try {
    const source = JSON.parse(Buffer.from(message.data, 'base64').toString());
    const { source_url, source_type } = source;

    console.log(`Fetching data from ${source_url} (${source_type})`);

    // Placeholder for fetching and parsing logic
    const articleUrls = await fetchArticleUrls(source_url, source_type);

    // Placeholder for duplicate checking
    const newArticleUrls = await checkForDuplicates(articleUrls);

    for (const articleUrl of newArticleUrls) {
      const message = {
        json: {
          article_url: articleUrl,
          source_domain: new URL(articleUrl).hostname,
        },
      };
      await exports.pubsub.topic(topicName).publishMessage(message);
      console.log(`Published message to ${topicName}: ${JSON.stringify(message.json)}`);
    }
  } catch (error) {
    console.error(`Error in fetchSourceData: ${error.message}`);
  }
};

async function fetchArticleUrls(source_url, source_type) {
  // In a real implementation, this would use different strategies based on source_type
  console.log(`Simulating fetching articles from ${source_url}`);
  return [
    `https://example.com/news-story-123?source=${new URL(source_url).hostname}`,
    `https://example.com/news-story-456?source=${new URL(source_url).hostname}`,
  ];
}

async function checkForDuplicates(articleUrls) {
  // In a real implementation, this would check against a database or cache
  console.log('Simulating duplicate check...');
  return articleUrls;
}

exports.pubsub = pubsub;
