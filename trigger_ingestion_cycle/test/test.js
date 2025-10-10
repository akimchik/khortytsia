const { expect } = require('chai');
const sinon = require('sinon');

// Import the module to be tested
const functionToTest = require('../index');

describe('triggerIngestionCycle', () => {
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

  it('should publish a message for each data source', async () => {
    const req = {};
    const res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub(),
    };

    await functionToTest.triggerIngestionCycle(req, res);

    // Check that the response is correct
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledWith('Ingestion cycle triggered successfully.')).to.be.true;

const dataSources = require('../data-sources.json');

    // Check that a message was published for each data source
    expect(publishMessageMock.callCount).to.equal(dataSources.length);
  });
});
