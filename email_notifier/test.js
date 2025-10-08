const assert = require('assert');
const sinon = require('sinon');
const { google } = require('googleapis');
const { emailNotifier } = require('../index');

describe('emailNotifier', () => {
  let gmailSendStub;

  beforeEach(() => {
    // Stub the Gmail API send method
    gmailSendStub = sinon.stub().resolves();
    const gmailStub = {
      users: {
        messages: {
          send: gmailSendStub,
        },
      },
    };
    sinon.stub(google, 'gmail').returns(gmailStub);
    sinon.stub(google.auth, 'GoogleAuth').returns({
        getClient: () => Promise.resolve({})
    });

    // Set environment variables for the test
    process.env.EMAIL_TO = 'test-recipient@example.com';
    process.env.EMAIL_FROM = 'test-sender@example.com';
  });

  afterEach(() => {
    sinon.restore();
    delete process.env.EMAIL_TO;
    delete process.env.EMAIL_FROM;
  });

  it('should send an email with the correct details from the Pub/Sub message', async () => {
    const pubSubEvent = {
      data: Buffer.from(JSON.stringify({ 
        companyName: 'TestCorp', 
        summary: 'This is a test summary.' 
      })).toString('base64'),
    };
    const context = { resource: 'test-resource', params: {} };

    await emailNotifier(pubSubEvent, context);

    // Verify that the gmail.users.messages.send method was called once
    assert.strictEqual(gmailSendStub.callCount, 1, 'Expected Gmail send method to be called once');

    // Verify the arguments passed to the send method
    const sendArgs = gmailSendStub.firstCall.args[0];
    assert.strictEqual(sendArgs.userId, 'me');

    const rawMessage = Buffer.from(sendArgs.requestBody.raw, 'base64').toString('utf-8');
    assert.ok(rawMessage.includes('To: test-recipient@example.com'), 'Email should be sent to the correct recipient');
    assert.ok(rawMessage.includes('From: test-sender@example.com'), 'Email should be sent from the correct sender');
    assert.ok(rawMessage.includes('Subject: New Article for Manual Review: TestCorp'), 'Email should have the correct subject');
    assert.ok(rawMessage.includes('<h3>TestCorp</h3>'), 'Email body should contain the company name');
    assert.ok(rawMessage.includes('This is a test summary.'), 'Email body should contain the summary');
  });

  it('should log an error if sending the email fails', async () => {
    // Arrange
    const consoleErrorStub = sinon.stub(console, 'error');
    gmailSendStub.rejects(new Error('Gmail API Error'));

    const pubSubEvent = {
      data: Buffer.from(JSON.stringify({ companyName: 'FailCorp', summary: 'Summary' })).toString('base64'),
    };
    const context = { resource: 'test-resource', params: {} };

    // Act
    await emailNotifier(pubSubEvent, context);

    // Assert
    assert.ok(consoleErrorStub.calledWith('Error sending email via Gmail API: Gmail API Error'), 'Should log the error message');
    consoleErrorStub.restore();
  });
});
