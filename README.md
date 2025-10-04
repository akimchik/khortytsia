# Khortytsia - A Serverless Data Ingestion Pipeline on GCP

This project implements a lightweight, high-performance, serverless data ingestion pipeline using Google Cloud Functions and Pub/Sub. The pipeline is designed to fetch data from various sources (APIs and websites), filter it based on keywords, and then pass it on for further analysis.

## Architecture

The pipeline consists of three main functions that work in a chain, orchestrated by Pub/Sub messages:

1.  **`trigger_ingestion_cycle`**: An HTTP-triggered function that starts the process.
2.  **`fetch_source_data`**: A Pub/Sub-triggered function that fetches a list of articles from a given source.
3.  **`filter_article_content`**: A Pub/Sub-triggered function that filters the content of an article for keywords.

![Architecture Diagram](https://storage.googleapis.com/khortytsia-assets/architecture.png)  *Note: You would need to create and upload this image to a GCS bucket.*

## Functions

### 1. `trigger_ingestion_cycle`

*   **Description:** This is the pacemaker of the whole system. It's a simple, time-based function that kicks off the data collection process at regular intervals.
*   **Trigger:** HTTP Request (intended to be called by a scheduler like Google Cloud Scheduler).
*   **Input:** None.
*   **Output:** Pub/Sub messages to the `source-to-fetch` topic.

### 2. `fetch_source_data`

*   **Description:** This function acts as the worker bee, fetching the raw data. One instance of this function is triggered for each message published by the `trigger_ingestion_cycle`.
*   **Trigger:** Pub/Sub message on the `source-to-fetch` topic.
*   **Input:** A message object containing `{ "source_url": "...", "source_type": "..." }`.
*   **Output:** Pub/Sub messages to the `article-to-filter` topic.

### 3. `filter_article_content`

*   **Description:** This is the module's core filter. It reads the full content of an article and decides if it's relevant.
*   **Trigger:** Pub/Sub message on the `article-to-filter` topic.
*   **Input:** A message object `{ "article_url": "...", "source_domain": "..." }`.
*   **Output:** If the article is relevant, it sends a final message to the `article-to-analyze` topic.

## Deployment

To deploy these functions to Google Cloud, you can use the `gcloud` command-line tool. 

First, you need to create the Pub/Sub topics:

```bash
gcloud pubsub topics create source-to-fetch
gcloud pubsub topics create article-to-filter
gcloud pubsub topics create article-to-analyze
```

Then, from within each function's directory, run the following commands:

**`trigger_ingestion_cycle`**

```bash
cd trigger_ingestion_cycle
gcloud functions deploy triggerIngestionCycle --runtime nodejs16 --trigger-http --allow-unauthenticated
cd ..
```

**`fetch_source_data`**

```bash
cd fetch_source_data
gcloud functions deploy fetchSourceData --runtime nodejs16 --trigger-topic source-to-fetch
cd ..
```

**`filter_article_content`**

```bash
cd filter_article_content
gcloud functions deploy filterArticleContent --runtime nodejs16 --trigger-topic article-to-filter
cd ..
```

## Self-Testing Code

To ensure the reliability and correctness of each function, it's crucial to have a suite of automated tests. We will use [Mocha](https://mochajs.org/) as our test framework and [Chai](https://www.chaijs.com/) for assertions.

### Setting up the Test Environment

In each function's directory, you'll need to install the testing libraries:

```bash
npm install mocha chai --save-dev
```

You will also need to add a `test` script to your `package.json` file:

```json
"scripts": {
  "test": "mocha"
}
```

### Example Test

Here is an example of how you would test the `trigger_ingestion_cycle` function. Create a `test` directory inside the `trigger_ingestion_cycle` directory, and then create a file named `test.js` inside the `test` directory.

**`trigger_ingestion_cycle/test/test.js`**

```javascript
const { expect } = require('chai');
const sinon = require('sinon');
const { PubSub } = require('@google-cloud/pubsub');

// Import the function to be tested
const { triggerIngestionCycle } = require('../index');

describe('triggerIngestionCycle', () => {
  let pubsubMock;
  let topicMock;
  let publishMessageMock;

  beforeEach(() => {
    // Mock the Pub/Sub client
    publishMessageMock = sinon.stub().resolves();
    topicMock = {
      publishMessage: publishMessageMock,
    };
    pubsubMock = sinon.stub(PubSub.prototype, 'topic').returns(topicMock);
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

    await triggerIngestionCycle(req, res);

    // Check that the response is correct
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledWith('Ingestion cycle triggered successfully.')).to.be.true;

    // Check that a message was published for each data source
    expect(publishMessageMock.callCount).to.equal(3); // 3 data sources in the mock
  });
});
```

To run the tests, you would navigate to the `trigger_ingestion_cycle` directory and run:

```bash
npm test
```

This approach of mocking the Pub/Sub client allows you to test the logic of your function without actually publishing any messages. You can apply the same principles to test the other functions in the pipeline.
