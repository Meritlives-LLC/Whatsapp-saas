const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Business = require('../models/Business');
const emailService = require('../services/emailService');
const logger = require('../config/logger');

const signAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const signRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: true, // always true — Render and Vercel are both HTTPS
    sameSite: 'none', // required for cross-origin (vercel.app → onrender.com)
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, businessName } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password))
      return res.status(400).json({ success: false, message: 'Password must contain uppercase, lowercase and a number' });

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    const user = await User.create({ name, email, password });
    const business = await Business.create({ owner: user._id, name: businessName || `${name}'s Business` });
    user.business = business._id;
    await user.save();

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);
    setRefreshCookie(res, refreshToken);
    emailService.sendWelcomeEmail(user, business.name).catch(() => {});
    logger.info(`New registration: ${user.email}`);

    res.status(201).json({
      success: true, token: accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      business: { id: business._id, name: business.name },
    });
  } catch (err) {
    logger.error(`Register error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password').populate('business');
    if (!user) {
      await new Promise(r => setTimeout(r, 500));
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (!(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account suspended. Contact support.' });

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);
    setRefreshCookie(res, refreshToken);
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });
    logger.info(`Login: ${user.email}`);

    res.json({
      success: true, token: accessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      business: user.business,
    });
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).populate('business');
    if (!user || !user.isActive)
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    const newAccessToken = signAccessToken(user._id);
    const newRefreshToken = signRefreshToken(user._id);
    setRefreshCookie(res, newRefreshToken);
    res.json({
      success: true, token: newAccessToken,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      business: user.business,
    });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
};

exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user, business: req.user.business });
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    await emailService.sendPasswordResetEmail(user, resetToken);
    logger.info(`Password reset requested: ${user.email}`);
    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    logger.error(`Forgot password error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Error sending reset email.' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!password || password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password))
      return res.status(400).json({ success: false, message: 'Password must contain uppercase, lowercase and a number' });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } });
    if (!user) return res.status(400).json({ success: false, message: 'Reset token is invalid or expired' });

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    logger.info(`Password reset completed: ${user.email}`);
    res.json({ success: true, message: 'Password reset successful. Please login.' });
  } catch (err) {
    logger.error(`Reset password error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Password reset failed.' });
  }
};

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  `${process.env.BACKEND_URL}/auth/google/callback`,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ email: profile.emails[0].value });
    if (!user) {
      user = await User.create({
        name:         profile.displayName,
        email:        profile.emails[0].value,
        password:     crypto.randomBytes(32).toString('hex'), // random — can't login with password
        googleId:     profile.id,
        isVerified:   true,
      });
      await Business.create({ owner: user._id, name: `${profile.displayName}'s Business` });
    }
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

exports.googleAuth = passport.authenticate('google', { scope: ['profile', 'email'] });

exports.googleCallback = [
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/auth?error=google_failed` }),
  (req, res) => {
    const accessToken  = signAccessToken(req.user._id);
    const refreshToken = signRefreshToken(req.user._id);
    setRefreshCookie(res, refreshToken);
    res.redirect(`${process.env.FRONTEND_URL}/auth/google/success?token=${accessToken}`);
  },
];