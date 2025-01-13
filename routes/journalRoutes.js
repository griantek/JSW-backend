const express = require('express');
const { searchJournals } = require('../controllers/journalController');

const router = express.Router();

router.post('/search', searchJournals);

module.exports = router;
