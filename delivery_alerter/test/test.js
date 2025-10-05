const test = require('ava');
const sinon = require('sinon');
const axios = require('axios');
const { deliverAlert } = require('../index');

// Set a dummy webhook URL for testing
process.env.WEBHOOK_URL = 'https://fake-webhook.com/test';

test.beforeEach((t) => {
  // Create a spy on axios.post to watch its behavior without making real calls
  t.context.axiosSpy = sinon.spy(axios, 'post');
});

test.afterEach.always((t) => {
  // Restore the original axios.post function after each test
  t.context.axiosSpy.restore();
});

test('deliverAlert should format and send a valid message', async (t) => {
  // 1. ARRANGE
  const leadData = {
    companyName: 'TestCo',
    industry: 'Testing',
    region: 'The Cloud',
    summary: 'TestCo is testing a new alert system.',
    potentialNeed: ['More tests', 'Better coverage'],
    sourceURL: 'https://example.com',
    verification: {
      confidenceScore: 99,
    },
  };

  const pubsubMessage = {
    data: Buffer.from(JSON.stringify(leadData)).toString('base64'),
  };

  // 2. ACT
  await deliverAlert(pubsubMessage, {});

  // 3. ASSERT
  // Check that axios.post was called exactly once
  t.true(t.context.axiosSpy.calledOnce, 'Expected axios.post to be called once');

  // Check that the message sent has the correct structure and content
  const firstCallArgs = t.context.axiosSpy.getCall(0).args;
  const webhookPayload = firstCallArgs[1]; // second argument of axios.post is the data

  t.is(webhookPayload.text, '🔥 New Opportunity Hunted: TestCo');
  t.is(webhookPayload.blocks[0].text.text, '🚀 TestCo');
  t.regex(webhookPayload.blocks[3].text.text, /More tests/);
});

test('deliverAlert should handle errors gracefully', async (t) => {
  // 1. ARRANGE
  const invalidMessage = {
    data: Buffer.from('this is not json').toString('base64'),
  };

  // Temporarily stub console.error to check if it's called
  const consoleErrorStub = sinon.stub(console, 'error');

  // 2. ACT
  await deliverAlert(invalidMessage, {});

  // 3. ASSERT
  // Check that axios.post was NOT called
  t.true(t.context.axiosSpy.notCalled, 'Expected axios.post to not be called');
  // Check that an error was logged to the console
  t.true(consoleErrorStub.called, 'Expected console.error to be called');

  consoleErrorStub.restore();
});
