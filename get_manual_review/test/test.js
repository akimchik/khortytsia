const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('getManualReview', () => {
  let functionToTest;
  let pubsubStub;
  let subscriptionStub;

  beforeEach(() => {
    // Create stubs for the PubSub client and its methods
    subscriptionStub = {
      on: sinon.stub(),
    };
    pubsubStub = {
      subscription: sinon.stub().returns(subscriptionStub),
    };

    // Use proxyquire to inject our mocked PubSub into the function
    functionToTest = proxyquire('../index', {
      '@google-cloud/pubsub': { PubSub: sinon.stub().returns(pubsubStub) },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return the analyses for manual review', () => {
    const req = {};
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };

    functionToTest.getManualReview(req, res);

    // Check the HTTP response
    expect(res.status.calledOnceWith(200)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
  });
});
