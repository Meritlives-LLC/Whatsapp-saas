const express = require('express');
const router = express.Router();

const metaOAuthController = require('../controllers/metaOAuthController');

router.get('/oauth-url', metaOAuthController.getOAuthUrl);
router.get('/token-status', metaOAuthController.getTokenStatus);
router.post('/select-phone', metaOAuthController.selectPhone);
router.delete('/disconnect', metaOAuthController.disconnect);
router.get('/oauth-callback', metaOAuthController.oauthCallback);

module.exports = router;