const { expect } = require('chai');
const sinon = require('sinon');

// Import the module to be tested
const functionToTest = require('../index');

describe('fetchSourceData', () => {
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

  it('should publish a message for each new article', async () => {
    const message = {
      data: Buffer.from(JSON.stringify({ source_url: 'https://example.com', source_type: 'API' })).toString('base64'),
    };

    await functionToTest.fetchSourceData(message, {});

    // Check that a message was published for each new article
    expect(publishMessageMock.callCount).to.equal(2); // 2 mock articles
    expect(publishMessageMock.firstCall.args[0].json.article_url).to.equal('https://example.com/news-story-123?source=example.com');
  });
});
