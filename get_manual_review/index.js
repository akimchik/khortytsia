/**
 * @fileoverview This Cloud Function provides an HTTP endpoint to retrieve all AI analyses
 * that have been flagged for manual review from the Firestore database.
 */

const { Firestore } = require('@google-cloud/firestore');
const firestore = new Firestore();
const manualReviewCollection = 'manual-review-queue';

/**
 * An HTTP-triggered Cloud Function that gets the list of analyses flagged for manual review.
 * 
 * This function queries the 'manual-review-queue' collection in Firestore and returns all
 * documents within it, allowing a front-end interface to display them to a human analyst.
 *
 * @param {Object} req The Express-style request object.
 * @param {Object} res The Express-style response object.
 */
exports.getManualReview = async (req, res) => {
  try {
    console.log('Fetching documents for manual review from Firestore...');

    const snapshot = await firestore.collection(manualReviewCollection).get();
    
    if (snapshot.empty) {
      console.log('No documents found in manual review queue.');
      return res.status(200).json([]);
    }

    const analyses = [];
    snapshot.forEach(doc => {
      analyses.push({
        id: doc.id, // Include the document ID so the front-end knows which document to update/delete
        ...doc.data()
      });
    });

    console.log(`Found ${analyses.length} document(s) for review.`);
    res.status(200).json(analyses);

  } catch (error) {
    console.error(`Error in getManualReview: ${error.message}`);
    res.status(500).send(`Error fetching documents for review: ${error.message}`);
  }
};