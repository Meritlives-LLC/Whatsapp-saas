// backend/config/meta.js
// Central place for the Meta Graph API version used across the whole
// WhatsApp/Meta integration (OAuth, Embedded Signup, messaging, token
// checks). Bump META_GRAPH_API_VERSION here (or via env) and every call
// site picks it up — don't hard-code graph.facebook.com/vXX.0 elsewhere.
//
// Current stable version as of this update: v23.0 (released 2025-05-29,
// supported until 2027-10-08). v21.0, which this codebase previously used
// everywhere, is still technically supported but is several versions
// behind — see https://developers.facebook.com/docs/graph-api/changelog
// for the current support table before bumping further.
const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || 'v23.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

module.exports = { GRAPH_API_VERSION, GRAPH_URL };
