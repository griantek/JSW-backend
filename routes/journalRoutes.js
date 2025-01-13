const express = require('express');
const { searchJournals } = require('../controllers/journalController');

const router = express.Router();

// Add OPTIONS handling
router.options('/search', (req, res) => {
    res.status(200).end();
});

router.post('/search', searchJournals);

module.exports = router;
