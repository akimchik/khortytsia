/**
 * @fileoverview This Cloud Function filters an article to determine if it is relevant
 * to our business interests based on a list of keywords.
 * It is triggered by a message on the 'article-to-filter' Pub/Sub topic.
 */

const { PubSub } = require('@google-cloud/pubsub');
const { Storage } = require('@google-cloud/storage');

const pubsub = new PubSub();
const storage = new Storage();
const topicName = 'article-to-analyze';
const keywordsBucket = process.env.KEYWORDS_BUCKET;

// A simple in-memory cache to avoid fetching the keywords file from GCS on every invocation.
let keywordsCache = null;

/**
 * Retrieves the list of keywords from a JSON file stored in a Google Cloud Storage bucket.
 * Implements an in-memory cache to reduce redundant GCS calls.
 * @returns {Promise<string[]>} A promise that resolves to an array of keywords.
 */
async function getKeywords() {
  if (keywordsCache) {
    return keywordsCache;
  }

  const bucket = storage.bucket(keywordsBucket);
  const file = bucket.file('keywords.json');
  const contents = await file.download();
  const keywords = JSON.parse(contents.toString()).keywords;
  keywordsCache = keywords; // Cache the keywords for subsequent invocations.
  return keywords;
}

/**
 * A Pub/Sub-triggered Cloud Function that filters an article's content for relevance.
 * 
 * This function fetches the full content of an article, checks it against a list of keywords
 * fetched from a GCS bucket, and if a match is found, publishes the article's content
 * to the 'article-to-analyze' topic for the AI analysis stage.
 *
 * @param {Object} message The Pub/Sub message, containing the base64-encoded data.
 * @param {string} message.data The base64-encoded JSON string with article details.
 * @param {Object} context The event metadata provided by Google Cloud Functions.
 */
exports.filterArticleContent = async (message, context) => {
  try {
    const article = JSON.parse(Buffer.from(message.data, 'base64').toString());
    const { article_url, source_domain } = article;

    console.log(`Filtering article from ${article_url}`);

    // Retrieve the keywords to check against.
    const keywords = await exports.getKeywords();

    // Fetch the full, clean text of the article.
    const articleContent = await exports.fetchAndExtractContent(article_url);

    // Determine if the article is relevant based on the keywords.
    const isRelevant = await exports.checkForKeywords(articleContent, keywords);

    if (isRelevant) {
      const message = {
        json: {
          clean_text: articleContent,
          source_url: article_url,
          source_domain: source_domain,
        },
      };
      // Publish the relevant article to the next stage of the pipeline.
      await exports.pubsub.topic(topicName).publishMessage(message);
      console.log(`Published relevant article to ${topicName}: ${article_url}`);
    }
  } catch (error) {
    console.error(`Error in filterArticleContent: ${error.message}`);
  }
};

/**
 * Simulates fetching and extracting the main content from a URL.
 * @param {string} article_url The URL of the article to process.
 * @returns {Promise<string>} A promise that resolves to the clean article text.
 */
exports.fetchAndExtractContent = async (article_url) => {
  // In a real implementation, this would use a library like Mercury Parser or Trafilatura
  // to strip ads, navigation, and other boilerplate, leaving only the core article text.
  console.log(`Simulating content extraction from ${article_url}`);
  return 'This is a sample article about business and tech.';
}

/**
 * Simulates checking for the presence of keywords in the article content.
 * @param {string} articleContent The full text of the article.
 * @param {string[]} keywords An array of keywords to search for.
 * @returns {Promise<boolean>} A promise that resolves to true if a keyword is found, otherwise false.
 */
exports.checkForKeywords = async (articleContent, keywords) => {
  // In a real implementation, a more efficient algorithm like Aho-Corasick would be
  // preferable for matching a large number of keywords.
  console.log('Simulating keyword check...');
  const lowercasedContent = articleContent.toLowerCase();
  return keywords.some(keyword => lowercasedContent.includes(keyword));
}

// Export modules for testing and for stubbing internal functions.
exports.pubsub = pubsub;
exports.getKeywords = getKeywords;
