const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('submitCorrection', () => {
  let functionToTest;
  let firestoreStub;
  let collectionStub;
  let addStub;

  beforeEach(() => {
    // Create stubs for the Firestore client and its methods
    addStub = sinon.stub().resolves();
    collectionStub = sinon.stub().returns({ add: addStub });
    firestoreStub = {
      collection: collectionStub,
    };

    // Use proxyquire to inject our mocked Firestore into the function
    functionToTest = proxyquire('../index', {
      '@google-cloud/firestore': { Firestore: sinon.stub().returns(firestoreStub) },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should save a valid corrected analysis', async () => {
    const req = {
      body: {
        id: 'test-id',
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
      },
    };
    const res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub(),
    };

    await functionToTest.submitCorrection(req, res);

    // Check that the analysis was saved to Firestore
    expect(firestoreStub.collection.calledOnceWith('corrected-analyses')).to.be.true;
    expect(addStub.calledOnce).to.be.true;

    // Check the HTTP response
    expect(res.status.calledOnceWith(200)).to.be.true;
  });

  it('should handle an invalid corrected analysis format', async () => {
    const req = {
      body: { invalid: 'format' },
    };
    const res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub(),
    };

    const consoleErrorStub = sinon.stub(console, 'error');
    await functionToTest.submitCorrection(req, res);
    consoleErrorStub.restore();

    // Check that the analysis was not saved to Firestore
    expect(addStub.callCount).to.equal(0);

    // Check the HTTP response
    expect(res.status.calledOnceWith(500)).to.be.true;
  });
});
