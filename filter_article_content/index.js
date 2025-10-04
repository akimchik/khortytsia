
const { PubSub } = require('@google-cloud/pubsub');
const { Storage } = require('@google-cloud/storage');

const pubsub = new PubSub();
const storage = new Storage();
const topicName = 'article-to-analyze';
const keywordsBucket = process.env.KEYWORDS_BUCKET;

let keywordsCache = null;

async function getKeywords() {
  if (keywordsCache) {
    return keywordsCache;
  }

  const bucket = storage.bucket(keywordsBucket);
  const file = bucket.file('keywords.json');
  const contents = await file.download();
  const keywords = JSON.parse(contents.toString()).keywords;
  keywordsCache = keywords;
  return keywords;
}

/**
 * Pub/Sub-triggered Cloud Function that filters article content.
 *
 * @param {Object} message The Pub/Sub message.
 * @param {Object} context The event metadata.
 */
exports.filterArticleContent = async (message, context) => {
  try {
    const article = JSON.parse(Buffer.from(message.data, 'base64').toString());
    const { article_url, source_domain } = article;

    console.log(`Filtering article from ${article_url}`);

    const keywords = await getKeywords();

    // Placeholder for fetching and extracting content
    const articleContent = await exports.fetchAndExtractContent(article_url);

    // Placeholder for keyword matching
    const isRelevant = await exports.checkForKeywords(articleContent, keywords);

    if (isRelevant) {
      const message = {
        json: {
          clean_text: articleContent,
          source_url: article_url,
          source_domain: source_domain,
        },
      };
      await exports.pubsub.topic(topicName).publishMessage(message);
      console.log(`Published relevant article to ${topicName}: ${article_url}`);
    }
  } catch (error) {
    console.error(`Error in filterArticleContent: ${error.message}`);
  }
};

exports.fetchAndExtractContent = async (article_url) => {
  // In a real implementation, this would use a library like Mercury Parser or Trafilatura
  console.log(`Simulating content extraction from ${article_url}`);
  return 'This is a sample article about business and tech.';
}

exports.checkForKeywords = async (articleContent, keywords) => {
  // In a real implementation, this would use a more efficient algorithm like Aho-Corasick
  console.log('Simulating keyword check...');
  const lowercasedContent = articleContent.toLowerCase();
  return keywords.some(keyword => lowercasedContent.includes(keyword));
}

exports.pubsub = pubsub;
