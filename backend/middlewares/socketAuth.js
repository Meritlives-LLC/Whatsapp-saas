// backend/middlewares/socketAuth.js
//
// Socket.io connections previously joined "rooms" purely on the client's
// say-so:
//
//   socket.on('join_business', (businessId) => socket.join(`business_${businessId}`));
//
// Any socket — authenticated or not — could pass an arbitrary businessId and
// silently receive that business's live customer conversations (new_message
// events include customer phone numbers, names and full message text).
// Mongo ObjectIds are not secrets, so this was a real cross-tenant data leak.
//
// This module verifies the same JWT used for REST auth during the socket
// handshake, and resolves the caller's OWN business id server-side. Callers
// are then only ever joined to their own room — the businessId is never
// taken from client input anywhere in the flow.

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Extract a bearer token from a Socket.io handshake, mirroring how the
 * REST `protect` middleware reads it, plus an `auth.token` field (the
 * standard socket.io-client way to send one).
 */
function extractToken(handshake) {
  const authToken = handshake?.auth?.token;
  if (authToken) return authToken;

  const header = handshake?.headers?.authorization;
  if (header?.startsWith('Bearer ')) return header.split(' ')[1];

  return null;
}

/**
 * Socket.io middleware (io.use(...)). On success, attaches
 * socket.data.userId and socket.data.businessId (string, or null if the
 * user has no business yet) and calls next(). On failure, calls
 * next(err) so the client gets a `connect_error` and the connection is
 * never established.
 */
function socketAuth() {
  return async (socket, next) => {
    try {
      const token = extractToken(socket.handshake);
      if (!token) return next(new Error('Unauthorized: no token provided'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id business isActive tokenVersion');
      if (!user) return next(new Error('Unauthorized: user not found'));
      if (!user.isActive) return next(new Error('Unauthorized: account suspended'));
      // Same tokenVersion check as the REST `protect` middleware — a socket
      // connecting with a token issued before a password change/reset must
      // not be allowed to attach to the live room.
      if ((decoded.ver || 0) !== (user.tokenVersion || 0)) {
        return next(new Error('Unauthorized: session no longer valid'));
      }

      socket.data.userId = String(user._id);
      socket.data.businessId = user.business ? String(user.business) : null;
      next();
    } catch (err) {
      logger.warn(`Socket auth rejected: ${err.message}`);
      next(new Error('Unauthorized'));
    }
  };
}

module.exports = { socketAuth, extractToken };
