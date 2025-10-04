const { expect } = require('chai');
const sinon = require('sinon');

// Import the module to be tested
const functionToTest = require('../index');

describe('filterArticleContent', () => {
  let topicMock;
  let publishMessageMock;

  beforeEach(() => {
    // Mock the Pub/Sub client
    publishMessageMock = sinon.stub().resolves();
    topicMock = {
      publishMessage: publishMessageMock,
    };
    functionToTest.pubsub = {
      topic: sinon.stub().returns(topicMock),
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should publish a message if the article is relevant', async () => {
    const message = {
      data: Buffer.from(JSON.stringify({ article_url: 'https://example.com/news-story-123', source_domain: 'example.com' })).toString('base64'),
    };

    await functionToTest.filterArticleContent(message, {});

    // Check that a message was published
    expect(publishMessageMock.callCount).to.equal(1);
    expect(publishMessageMock.firstCall.args[0].json.clean_text).to.equal('This is a sample article about business and tech.');
  });

  it('should not publish a message if the article is not relevant', async () => {
    const message = {
      data: Buffer.from(JSON.stringify({ article_url: 'https://example.com/news-story-123', source_domain: 'example.com' })).toString('base64'),
    };

    // Override the mock to return irrelevant content
    const checkForKeywordsStub = sinon.stub(functionToTest, 'checkForKeywords').resolves(false);

    await functionToTest.filterArticleContent(message, {});

    // Check that no message was published
    expect(publishMessageMock.callCount).to.equal(0);

    checkForKeywordsStub.restore();
  });
});
