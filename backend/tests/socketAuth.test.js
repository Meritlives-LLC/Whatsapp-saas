// backend/tests/socketAuth.test.js
//
// Regression test for a vulnerability found during this audit: Socket.io's
// 'join_business' event took a businessId straight from the client and
// joined that room with no authentication or ownership check at all —
//   socket.on('join_business', (businessId) => socket.join(`business_${businessId}`));
// Any socket (no login required) could join ANY tenant's room and silently
// receive that business's live customer conversations. socketAuth() closes
// this by verifying the same JWT used for REST auth during the handshake
// and resolving the caller's OWN business id server-side — a client can
// never supply or influence which room it lands in.

jest.mock('../models/User');
jest.mock('../config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { socketAuth, extractToken } = require('../middlewares/socketAuth');

const OLD_SECRET = process.env.JWT_SECRET;
beforeAll(() => { process.env.JWT_SECRET = 'test-jwt-secret'; });
afterAll(() => { process.env.JWT_SECRET = OLD_SECRET; });

function mockSocket(handshake) {
  return { handshake, data: {} };
}

function selectableUser(doc) {
  // Mirrors User.findById(id).select(...) chaining used in socketAuth.js
  return { select: jest.fn().mockResolvedValue(doc) };
}

beforeEach(() => jest.clearAllMocks());

describe('extractToken', () => {
  test('reads token from handshake.auth.token (socket.io-client standard)', () => {
    expect(extractToken({ auth: { token: 'abc123' } })).toBe('abc123');
  });

  test('falls back to an Authorization: Bearer header', () => {
    expect(extractToken({ headers: { authorization: 'Bearer xyz789' } })).toBe('xyz789');
  });

  test('returns null when neither is present', () => {
    expect(extractToken({})).toBeNull();
    expect(extractToken({ headers: {} })).toBeNull();
  });
});

describe('socketAuth middleware', () => {
  test('rejects a connection with no token at all', async () => {
    const socket = mockSocket({});
    const next = jest.fn();
    await socketAuth()(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.data.businessId).toBeUndefined();
  });

  test('rejects a connection with an invalid/forged token', async () => {
    const socket = mockSocket({ auth: { token: 'not-a-real-jwt' } });
    const next = jest.fn();
    await socketAuth()(socket, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('rejects a connection whose user no longer exists', async () => {
    const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
    User.findById.mockReturnValue(selectableUser(null));

    const socket = mockSocket({ auth: { token } });
    const next = jest.fn();
    await socketAuth()(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('rejects a suspended account', async () => {
    const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
    User.findById.mockReturnValue(selectableUser({ _id: 'user-1', business: 'biz-1', isActive: false }));

    const socket = mockSocket({ auth: { token } });
    const next = jest.fn();
    await socketAuth()(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('accepts a valid token and resolves the CALLER OWN business id — never a client-supplied one', async () => {
    const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
    User.findById.mockReturnValue(selectableUser({ _id: 'user-1', business: 'my-own-business-id', isActive: true }));

    // Even if a client tried to smuggle a different businessId onto the
    // handshake, only the id resolved from the verified JWT is ever used.
    const socket = mockSocket({ auth: { token, businessId: 'someone-elses-business-id' } });
    const next = jest.fn();
    await socketAuth()(socket, next);

    expect(next).toHaveBeenCalledWith(); // called with no error
    expect(socket.data.userId).toBe('user-1');
    expect(socket.data.businessId).toBe('my-own-business-id');
  });

  test('a user with no business yet gets businessId: null, not an error', async () => {
    const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
    User.findById.mockReturnValue(selectableUser({ _id: 'user-1', business: null, isActive: true }));

    const socket = mockSocket({ auth: { token } });
    const next = jest.fn();
    await socketAuth()(socket, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data.businessId).toBeNull();
  });
});
