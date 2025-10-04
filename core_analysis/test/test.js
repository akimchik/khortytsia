const { expect } = require('chai');
const sinon = require('sinon');

// Import the module to be tested
const functionToTest = require('../index');

describe('coreAnalysis', () => {
  let topicMock;
  let publishMessageMock;
  let generateContentStub;

  beforeEach(() => {
    // Mock the Pub/Sub client
    publishMessageMock = sinon.stub().resolves();
    topicMock = {
      publishMessage: publishMessageMock,
    };
    functionToTest.pubsub = {
      topic: sinon.stub().returns(topicMock),
    };

    // Mock the Vertex AI client
    generateContentStub = sinon.stub().resolves({
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
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
                  }),
                },
              ],
            },
          },
        ],
      },
    });

    functionToTest.vertexai = {
      preview: {
        getGenerativeModel: sinon.stub().returns({ generateContent: generateContentStub }),
      },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should process a valid article and publish the analysis', async () => {
    const message = {
      data: Buffer.from(
        JSON.stringify({
          clean_text: 'This is a test article.',
          source_url: 'https://example.com/news-story-123',
          source_domain: 'example.com',
        })
      ).toString('base64'),
    };

    await functionToTest.coreAnalysis(message, {});

    // Check that messages were published to both topics
    expect(publishMessageMock.callCount).to.equal(2);
    expect(functionToTest.pubsub.topic.calledWith('external-verification')).to.be.true;
    expect(functionToTest.pubsub.topic.calledWith('internal-qc')).to.be.true;
  });

  it('should handle an invalid article format', async () => {
    const message = {
      data: Buffer.from(JSON.stringify({ invalid: 'format' })).toString('base64'),
    };

    await functionToTest.coreAnalysis(message, {});

    // Check that no messages were published
    expect(publishMessageMock.callCount).to.equal(0);
  });

  it('should handle an invalid analysis format from the AI', async () => {
    // Override the mock to return invalid JSON
    generateContentStub.resolves({
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'invalid json',
                },
              ],
            },
          },
        ],
      },
    });

    const message = {
      data: Buffer.from(
        JSON.stringify({
          clean_text: 'This is a test article.',
          source_url: 'https://example.com/news-story-123',
          source_domain: 'example.com',
        })
      ).toString('base64'),
    };

    await functionToTest.coreAnalysis(message, {});

    // Check that no messages were published
    expect(publishMessageMock.callCount).to.equal(0);
  });
});
