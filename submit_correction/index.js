/**
 * @fileoverview This Cloud Function provides an HTTP endpoint for submitting a manually
 * corrected AI analysis. The submitted data is stored in Firestore for fine-tuning, and the
 * original item is removed from the manual review queue.
 */

const { Firestore } = require('@google-cloud/firestore');
const firestore = new Firestore();

const correctionsCollection = 'corrected-analyses';
const manualReviewCollection = 'manual-review-queue';

/**
 * An HTTP-triggered Cloud Function that saves a corrected AI analysis and removes it from the review queue.
 * 
 * This function expects a POST request where the body contains the corrected analysis object,
 * including the 'id' of the document in the manual review queue. It saves the correction
 * to a new collection for fine-tuning and deletes the original document from the review queue.
 *
 * @param {Object} req The Express-style request object.
 * @param {Object} req.body The corrected analysis object, including the document `id`.
 * @param {Object} res The Express-style response object.
 */
exports.submitCorrection = async (req, res) => {
  try {
    const correctedAnalysis = req.body;
    const docId = correctedAnalysis.id;

    if (!docId) {
      throw new Error('Document ID is missing from the request body.');
    }

    // 1. Save the corrected version for fine-tuning purposes.
    const collectionRef = firestore.collection(correctionsCollection);
    await collectionRef.add(correctedAnalysis);
    console.log(`Saved correction for document ${docId}.`);

    // 2. Delete the original from the manual review queue.
    const docRef = firestore.doc(`${manualReviewCollection}/${docId}`);
    await docRef.delete();
    console.log(`Removed document ${docId} from the manual review queue.`);

    res.status(200).send(`Correction for ${docId} submitted successfully.`);

  } catch (error) {
    console.error(`Error in submitCorrection: ${error.message}`);
    res.status(500).send(`Error in submitCorrection: ${error.message}`);
  }
};