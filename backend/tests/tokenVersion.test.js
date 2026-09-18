// backend/tests/tokenVersion.test.js
//
// Regression test for a gap found during this audit: neither logout() nor
// a password change/reset actually invalidated previously-issued JWTs.
// A stolen refresh token (or an access token minted before a password
// change) stayed valid for its full remaining lifetime regardless of what
// the user did afterwards.
//
// Fix: User.tokenVersion is bumped whenever the password changes
// (models/User.js pre('save') hook), both access and refresh tokens carry
// the tokenVersion they were issued with as `ver`, and protect()/
// refreshToken()/socketAuth() all reject a token whose `ver` no longer
// matches the user's current tokenVersion.

jest.mock('../models/User');
jest.mock('../config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middlewares/auth');

const OLD_SECRET = process.env.JWT_SECRET;
beforeAll(() => { process.env.JWT_SECRET = 'test-jwt-secret'; });
afterAll(() => { process.env.JWT_SECRET = OLD_SECRET; });

function selectablePopulatableUser(doc) {
  const chain = {
    populate: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue(doc),
  };
  return chain;
}

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

beforeEach(() => jest.clearAllMocks());

describe('protect — tokenVersion invalidation', () => {
  test('accepts a token whose ver matches the current tokenVersion', async () => {
    const token = jwt.sign({ id: 'user-1', ver: 2 }, process.env.JWT_SECRET);
    User.findById.mockReturnValue(selectablePopulatableUser({ _id: 'user-1', tokenVersion: 2, isActive: true }));

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await protect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200); // untouched — protect() never set it
  });

  test('rejects a token issued before a password change (stale ver)', async () => {
    // Token was minted with ver: 0; the user's password has since been
    // changed, bumping tokenVersion to 1.
    const token = jwt.sign({ id: 'user-1', ver: 0 }, process.env.JWT_SECRET);
    User.findById.mockReturnValue(selectablePopulatableUser({ _id: 'user-1', tokenVersion: 1, isActive: true }));

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await protect(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  test('a token predating the tokenVersion field (no ver claim) is treated as ver 0', async () => {
    const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET); // no `ver`
    User.findById.mockReturnValue(selectablePopulatableUser({ _id: 'user-1', tokenVersion: 0, isActive: true }));

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await protect(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('User model — tokenVersion bump on password change', () => {
  // These construct a real (unmocked, unsaved) Mongoose document to exercise
  // the actual pre('save') hook logic in models/User.js. isModified() and
  // hook execution work without a live DB connection; only .save() itself
  // (the actual write) would require one, which we don't need here.
  let RealUser;
  beforeAll(() => {
    jest.resetModules();
    jest.dontMock('../models/User');
    RealUser = require('../models/User');
  });

  function runPreSaveHooks(doc) {
    return new Promise((resolve, reject) => {
      doc.schema._middlewareFuncs || true; // no-op, keeps intent explicit
      doc.$__.saveOptions = {};
      RealUser.schema.s.hooks.execPre('save', doc, (err) => (err ? reject(err) : resolve()));
    });
  }

  test('a brand-new document does not get its tokenVersion bumped', async () => {
    const doc = new RealUser({ name: 'A', email: 'a@example.com', password: 'InitialPass1' });
    expect(doc.isNew).toBe(true);
    await runPreSaveHooks(doc);
    expect(doc.tokenVersion).toBe(0); // schema default, untouched
  });

  test('changing the password on an existing document bumps tokenVersion', async () => {
    const doc = new RealUser({ name: 'A', email: 'a@example.com', password: 'InitialPass1' });
    await runPreSaveHooks(doc); // simulate the initial save that created it
    doc.isNew = false;
    doc.tokenVersion = 3; // simulate a doc that already had some sessions issued

    doc.password = 'BrandNewPassword1';
    expect(doc.isModified('password')).toBe(true);
    await runPreSaveHooks(doc);

    expect(doc.tokenVersion).toBe(4);
  });
});
