const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('coreAnalysis', () => {
  let functionToTest;
  let createExecutionStub;
  let generateContentStub;

  beforeEach(() => {
    // Create stubs for the Workflows client and its methods
    createExecutionStub = sinon.stub().resolves([{ name: 'test-execution' }]);
    const workflowsStub = {
      createExecution: createExecutionStub,
      workflowPath: sinon.stub(),
    };

    // Create stubs for the Vertex AI client and its methods
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
    const vertexaiStub = {
      preview: {
        getGenerativeModel: sinon.stub().returns({ generateContent: generateContentStub }),
      },
    };

    // Use proxyquire to inject our mocked clients into the function
    functionToTest = proxyquire('../index', {
      '@google-cloud/workflows': { WorkflowsClient: sinon.stub().returns(workflowsStub) },
      '@google-cloud/vertexai': { VertexAI: sinon.stub().returns(vertexaiStub) },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should process a valid article and trigger the workflow', async () => {
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

    // Check that the workflow was triggered
    expect(createExecutionStub.calledOnce).to.be.true;
  });

  it('should handle an invalid article format', async () => {
    const message = {
      data: Buffer.from(JSON.stringify({ invalid: 'format' })).toString('base64'),
    };

    const consoleErrorStub = sinon.stub(console, 'error');
    await functionToTest.coreAnalysis(message, {});
    consoleErrorStub.restore();

    // Check that the workflow was not triggered
    expect(createExecutionStub.callCount).to.equal(0);
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

    const consoleErrorStub = sinon.stub(console, 'error');
    await functionToTest.coreAnalysis(message, {});
    consoleErrorStub.restore();

    // Check that the workflow was not triggered
    expect(createExecutionStub.callCount).to.equal(0);
  });
});