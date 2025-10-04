const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('internalQc', () => {
  let functionToTest;
  let pubsubStub;
  let topicStub;
  let publishStub;

  beforeEach(() => {
    // Create stubs for the PubSub client and its methods
    publishStub = sinon.stub().resolves('mock-message-id');
    topicStub = sinon.stub().returns({ publishMessage: publishStub });
    pubsubStub = sinon.stub().returns({ topic: topicStub });

    // Use proxyquire to inject our mocked PubSub into the function
    functionToTest = proxyquire('../index', {
      '@google-cloud/pubsub': { PubSub: pubsubStub },
    });
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
          summary: 'Logistics operator Karpatska Logistics has announced a $20M investment that will allow them to double their cargo handling volumes.',
          potentialNeed: [
            'Construction Services',
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

    await functionToTest.internalQc(message, {});

    // Check that a message was published to the correct topic
    expect(pubsubStub.calledOnce).to.be.true;
    expect(topicStub.calledOnceWith('decision-engine-queue')).to.be.true;
    expect(publishStub.calledOnce).to.be.true;

    // Check the content of the published message
    const publishedMessage = publishStub.firstCall.args[0].json;
    expect(publishedMessage).to.have.property('internal_qc');
    expect(publishedMessage.internal_qc.qualityScore).to.be.above(90);
  });

  it('should identify business rule violations', async () => {
    const message = {
      data: Buffer.from(
        JSON.stringify({
          companyName: 'Tech Corp',
          industry: 'Technology',
          region: 'Kyiv',
          opportunityType: 'Expansion',
          summary: 'Short summary',
          potentialNeed: [],
          opportunityScore: 6,
          keyQuote: 'A quote.',
          sourceURL: 'https://example.com/news-story-456',
        })
      ).toString('base64'),
    };

    await functionToTest.internalQc(message, {});

    // Check that a message was published
    expect(pubsubStub.calledOnce).to.be.true;
    expect(topicStub.calledOnceWith('decision-engine-queue')).to.be.true;
    expect(publishStub.calledOnce).to.be.true;

    // Check the content of the published message
    const publishedMessage = publishStub.firstCall.args[0].json;
    expect(publishedMessage).to.have.property('internal_qc');
    expect(publishedMessage.internal_qc.qualityScore).to.be.below(100);
    expect(publishedMessage.internal_qc.rulesFailed).to.equal(2);
  });

  it('should handle an invalid analysis format', async () => {
    const message = {
      data: Buffer.from(JSON.stringify({ invalid: 'format' })).toString('base64'),
    };

    await functionToTest.internalQc(message, {});

    // Check that no messages were published
    expect(publishStub.callCount).to.equal(0);
  });
});
