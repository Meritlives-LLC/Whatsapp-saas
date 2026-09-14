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

// Embedded Signup (FB.login() popup) callback — called in-page by an
// already-authenticated request, so this is protected like the rest of the
// account-scoped endpoints above (unlike /oauth-callback, which is Meta's
// own browser redirect target and can't carry our auth header).
router.post('/embedded-signup-callback', protect, metaOAuthController.embeddedSignupCallback);

module.exports = router;