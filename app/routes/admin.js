const express = require('express');
const router = express.Router();
const { revisionCertificacion } = require('../controllers/admin');

router.post('/revision-certificacion/', revisionCertificacion);

module.exports = router;
