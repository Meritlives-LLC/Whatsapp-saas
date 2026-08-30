const express = require('express');
const router = express.Router();

const metaOAuthController = require('../controllers/metaOAuthController');
const { protect } = require('../middlewares/auth'); // 👈 ADD THIS

router.get('/oauth-url', protect, metaOAuthController.getOAuthUrl);
router.get('/token-status', protect, metaOAuthController.tokenStatus);
router.get('/pending-connection', protect, metaOAuthController.getPendingConnection);
router.post('/select-phone', protect, metaOAuthController.selectPhone);
router.delete('/disconnect', protect, metaOAuthController.disconnect);
router.get('/oauth-callback', metaOAuthController.oauthCallback);

module.exports = router;