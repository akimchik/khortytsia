const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('getManualReview', () => {
  let functionToTest;
  let firestoreStub;
  let collectionStub;
  let getStub;

  beforeEach(() => {
    // Mock the Firestore client and its methods
    getStub = sinon.stub();
    collectionStub = sinon.stub().returns({ get: getStub });
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

  it('should return the analyses for manual review from firestore', async () => {
    // 1. ARRANGE
    const mockData = {
      id: 'test-id-1',
      companyName: 'TestCo',
    };
    const mockDoc = {
      id: mockData.id,
      data: () => mockData,
    };
    const mockSnapshot = {
      empty: false,
      forEach: (callback) => callback(mockDoc),
    };
    getStub.resolves(mockSnapshot);

    const req = {};
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };

    // 2. ACT
    await functionToTest.getManualReview(req, res);

    // 3. ASSERT
    expect(res.status.calledOnceWith(200)).to.be.true;
    expect(res.json.calledOnce).to.be.true;
    const responseData = res.json.firstCall.args[0];
    expect(responseData).to.be.an('array').with.lengthOf(1);
    expect(responseData[0].companyName).to.equal('TestCo');
  });

  it('should return an empty array when no documents are found', async () => {
    // 1. ARRANGE
    const mockSnapshot = { empty: true };
    getStub.resolves(mockSnapshot);

    const req = {};
    const res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };

    // 2. ACT
    await functionToTest.getManualReview(req, res);

    // 3. ASSERT
    expect(res.status.calledOnceWith(200)).to.be.true;
    expect(res.json.calledOnceWith([])).to.be.true;
  });
});