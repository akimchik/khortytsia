const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('decisionEngine', () => {
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

  it('should process a valid enriched analysis and publish the final analysis', async () => {
    const req = {
      body: {
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
        verification: {
          confidenceScore: 92,
          sourceReputationScore: 85,
          corroboratingSources: 3,
          corroboratingUrls: [
            'https://trusted-source-1.com/article-A',
            'https://trusted-source-2.com/article-B',
            'https://trusted-source-3.com/article-C',
          ],
          lastCheckedTimestamp: '2025-10-04T23:31:37Z',
        },
        internal_qc: {
          qualityScore: 95,
          rulesPassed: 19,
          rulesFailed: 1,
          failedRules: [
            'Summary length is less than the required 50 characters.',
          ],
          logicalConsistency: 'Passed',
          toneAnalysis: 'Passed',
          lastCheckedTimestamp: '2025-10-04T23:31:38Z',
        },
      },
    };
    const res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub(),
    };

    await functionToTest.decisionEngine(req, res);

    // Check that a message was published to the correct topic
    expect(pubsubStub.calledOnce).to.be.true;
    expect(topicStub.calledOnceWith('final-analysis')).to.be.true;
    expect(publishStub.calledOnce).to.be.true;

    // Check the content of the published message
    const publishedMessage = publishStub.firstCall.args[0].json;
    expect(publishedMessage).to.have.property('decision');
    expect(publishedMessage.decision).to.equal('Approved');

    // Check the HTTP response
    expect(res.status.calledOnceWith(200)).to.be.true;
  });

  it('should handle an invalid enriched analysis format', async () => {
    const req = {
      body: { invalid: 'format' },
    };
    const res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub(),
    };

    await functionToTest.decisionEngine(req, res);

    // Check that no messages were published
    expect(publishStub.callCount).to.equal(0);

    // Check the HTTP response
    expect(res.status.calledOnceWith(400)).to.be.true;
  });
});
