/**
 * @fileoverview This Cloud Function provides an HTTP endpoint for submitting a manually
 * corrected AI analysis. The submitted data is stored in Firestore and can be used as a dataset
 * for fine-tuning the AI model in the future.
 */

const { Firestore } = require('@google-cloud/firestore');

const firestore = new Firestore();

/**
 * An HTTP-triggered Cloud Function that saves a corrected AI analysis to Firestore.
 * 
 * This function expects a POST request where the body contains the full, corrected analysis object.
 * It then adds this object as a new document to the 'corrected-analyses' collection in Firestore.
 * This creates a valuable dataset for periodically fine-tuning and improving the core AI model.
 *
 * @param {Object} req The Express-style request object.
 * @param {Object} req.body The corrected analysis object.
 * @param {Object} res The Express-style response object.
 */
exports.submitCorrection = async (req, res) => {
  try {
    const correctedAnalysis = req.body;

    // A real implementation should include validation (e.g., with Joi) to ensure
    // the incoming object has the correct schema before saving.

    const collectionRef = firestore.collection('corrected-analyses');
    await collectionRef.add(correctedAnalysis);

    res.status(200).send('Correction submitted successfully.');
  } catch (error) {
    console.error(`Error in submitCorrection: ${error.message}`);
    res.status(500).send(`Error in submitCorrection: ${error.message}`);
  }
};
