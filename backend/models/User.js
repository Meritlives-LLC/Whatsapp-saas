const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, maxlength: 100 },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 8, select: false },
  role:     { type: String, enum: ['admin', 'business'], default: 'business' },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' },
  isActive: { type: Boolean, default: true },
  googleId:    { type: String },
  isVerified:  { type: Boolean, default: false },
  passwordResetToken:   { type: String, select: false },
  passwordResetExpires: { type: Date,   select: false },
  lastLoginAt: { type: Date },
  // Bumped whenever all existing sessions must be invalidated (password
  // change, password reset). Both access and refresh JWTs carry the
  // tokenVersion they were issued with as `ver`; auth.js/refreshToken
  // reject a token whose `ver` no longer matches this field. Without this,
  // a stolen refresh token (or a token issued before a password change)
  // stayed valid for its full remaining lifetime no matter what the user
  // did afterwards.
  tokenVersion: { type: Number, default: 0 },
}, {
  timestamps: true,
  // getMe() and similar endpoints return `req.user` more or less as-is —
  // tokenVersion is an internal bookkeeping counter, not something the
  // client needs to see. (The auth middlewares read it straight off the
  // Mongoose document before this transform ever runs, so the check itself
  // is unaffected.)
  toJSON: {
    transform(doc, ret) {
      delete ret.tokenVersion;
      return ret;
    },
  },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  // Changing the password invalidates every previously-issued token.
  if (!this.isNew) this.tokenVersion = (this.tokenVersion || 0) + 1;
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);