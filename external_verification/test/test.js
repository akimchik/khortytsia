const { expect } = require('chai');
const sinon = require('sinon');
const axios = require('axios');
const { PubSub } = require('@google-cloud/pubsub');
const { GoogleAuth } = require('google-auth-library');

// Import the module to be tested
const functionToTest = require('../index');

describe('externalVerification', () => {
  let pubsubMock;
  let topicMock;
  let publishMessageMock;
  let axiosMock;
  let authMock;

  beforeEach(() => {
    // Mock the Pub/Sub client
    publishMessageMock = sinon.stub().resolves();
    topicMock = {
      publishMessage: publishMessageMock,
    };
    functionToTest.pubsub = {
      topic: sinon.stub().returns(topicMock),
    };

    // Mock axios
    axiosMock = sinon.stub(axios, 'get').resolves({ data: {} });

    // Mock GoogleAuth
    authMock = sinon.stub(GoogleAuth.prototype, 'getRequestHeaders').resolves({});
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should process a valid analysis and publish the enriched analysis', async () => {
    const message = {
      data: Buffer.from(
        JSON.stringify({
          companyName: 'Karpatska Logistics',
          industry: 'Logistics and Warehousing',
          region: 'Lviv Oblast',
          opportunityType: 'New Construction',
          summary: 'Logistics operator Karpatska Logistics has announced a $20M investment...',
          potentialNeed: [
            'High-bay racking systems',
            'Warehouse Management Software (WMS)',
            'Security and access control systems',
          ],
          opportunityScore: 9,
          keyQuote: 'This will allow us to double our cargo handling volumes...',
          sourceURL: 'https://example.com/news-story-123',
        })
      ).toString('base64'),
    };

    await functionToTest.externalVerification(message, {});

    // Check that a message was published to the correct topic
    expect(publishMessageMock.callCount).to.equal(1);
    expect(functionToTest.pubsub.topic.calledWith('decision-engine-queue')).to.be.true;

    // Check the content of the published message
    const publishedMessage = publishMessageMock.firstCall.args[0].json;
    expect(publishedMessage).to.have.property('verification');
    expect(publishedMessage.verification).to.have.property('confidenceScore');
  });

  it('should handle an invalid analysis format', async () => {
    const message = {
      data: Buffer.from(JSON.stringify({ invalid: 'format' })).toString('base64'),
    };

    await functionToTest.externalVerification(message, {});

    // Check that no messages were published
    expect(publishMessageMock.callCount).to.equal(0);
  });
});
