/**
 * @fileoverview This Cloud Function is responsible for fetching a list of article URLs from a single data source.
 * It is triggered by a message on the 'source-to-fetch' Pub/Sub topic.
 */

const { PubSub } = require('@google-cloud/pubsub');
const pubsub = new PubSub();
const topicName = 'article-to-filter';

/**
 * A Pub/Sub-triggered Cloud Function that fetches raw article data from a given source.
 * 
 * This function receives a source URL and type (API or Scrape), fetches a list of
 * individual article URLs from that source, checks for duplicates against a (simulated) persistent store,
 * and then publishes a message for each new, unique article to the 'article-to-filter' topic.
 *
 * @param {Object} message The Pub/Sub message, containing the base64-encoded data.
 * @param {string} message.data The base64-encoded JSON string with source details.
 * @param {Object} context The event metadata provided by Google Cloud Functions.
 */
exports.fetchSourceData = async (message, context) => {
  try {
    const source = JSON.parse(Buffer.from(message.data, 'base64').toString());
    const { source_url, source_type } = source;

    console.log(`Fetching data from ${source_url} (${source_type})`);

    // In a real implementation, this would use different strategies (e.g., Axios for APIs,
    // Puppeteer or Cheerio for scraping) based on the source_type.
    const articleUrls = await fetchArticleUrls(source_url, source_type);

    // To prevent processing the same article multiple times, we check against a database or cache.
    const newArticleUrls = await checkForDuplicates(articleUrls);

    // For each new article, publish a message to the next topic for filtering.
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

/**
 * Simulates fetching a list of article URLs from a source.
 * @param {string} source_url The URL of the data source.
 * @param {string} source_type The type of the data source ('API' or 'Scrape').
 * @returns {Promise<string[]>} A promise that resolves to an array of article URLs.
 */
async function fetchArticleUrls(source_url, source_type) {
  // This is a placeholder. A real implementation would have robust logic here.
  console.log(`Simulating fetching articles from ${source_url}`);
  return [
    `https://example.com/news-story-123?source=${new URL(source_url).hostname}`,
    `https://example.com/news-story-456?source=${new URL(source_url).hostname}`,
  ];
}

/**
 * Simulates checking for duplicate article URLs.
 * @param {string[]} articleUrls An array of article URLs to check.
 * @returns {Promise<string[]>} A promise that resolves to an array of unique article URLs.
 */
async function checkForDuplicates(articleUrls) {
  // This is a placeholder. A real implementation would check against a database like Redis or Firestore.
  console.log('Simulating duplicate check...');
  return articleUrls;
}

// Export the pubsub client for easier testing and mocking.
exports.pubsub = pubsub;
