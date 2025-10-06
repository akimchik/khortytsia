const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('submitCorrection', () => {
  let functionToTest;
  let firestoreStub;
  let collectionStub;
  let addStub;
  let docStub;
  let deleteStub;

  beforeEach(() => {
    // 1. Create stubs for all the methods we expect to call
    addStub = sinon.stub().resolves();
    deleteStub = sinon.stub().resolves();
    
    // 2. Stub the chain of calls
    // firestore.doc() returns an object that has a .delete() method
    docStub = sinon.stub().returns({ delete: deleteStub });
    // firestore.collection() returns an object that has an .add() method
    collectionStub = sinon.stub().returns({ add: addStub });

    // 3. Create the main Firestore client mock with all the methods we need
    firestoreStub = {
      collection: collectionStub,
      doc: docStub,
    };

    // 4. Use proxyquire to inject our complete mock
    functionToTest = proxyquire('../index', {
      '@google-cloud/firestore': { Firestore: sinon.stub().returns(firestoreStub) },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should save a correction and delete the item from the review queue', async () => {
    // ARRANGE
    const req = {
      body: {
        id: 'test-doc-id-123',
        companyName: 'TestCo Corrected',
      },
    };
    const res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub(),
    };

    // ACT
    await functionToTest.submitCorrection(req, res);

    // ASSERT
    // Check that the correction was saved
    expect(collectionStub.calledOnceWith('corrected-analyses')).to.be.true;
    expect(addStub.calledOnceWith(req.body)).to.be.true;

    // Check that the original was deleted from the queue
    expect(docStub.calledOnceWith('manual-review-queue/test-doc-id-123')).to.be.true;
    expect(deleteStub.calledOnce).to.be.true;

    // Check the HTTP response
    expect(res.status.calledOnceWith(200)).to.be.true;
  });

  it('should handle requests with no document ID', async () => {
    // ARRANGE
    const req = {
      body: { companyName: 'A company without an ID' }, // No 'id' property
    };
    const res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub(),
    };

    // ACT
    await functionToTest.submitCorrection(req, res);

    // ASSERT
    // Check that no database operations were attempted
    expect(addStub.notCalled).to.be.true;
    expect(deleteStub.notCalled).to.be.true;

    // Check that a 500 error was returned
    expect(res.status.calledOnceWith(500)).to.be.true;
  });
});