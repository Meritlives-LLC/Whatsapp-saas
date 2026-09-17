// backend/tests/indexes.test.js
//
// Verifies the tenant-isolation invariant "one WhatsApp Phone Number ID ->
// one SaaS Business" is actually enforced at the DATABASE level, not just in
// application code.
//
// NOTE ON SCOPE: these tests drive config/indexes.js against a mocked
// MongoDB driver, so they verify that the correct index specification is
// created (unique + partialFilterExpression) and that an outdated index on
// the same key is dropped first. They do NOT prove MongoDB itself rejects a
// duplicate insert — that requires a real mongod and must be checked against
// a staging database before production (see the deployment notes).

jest.mock('../config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const mockCollections = {};

function mockMakeCollection(name, existingIndexes = []) {
  const col = {
    _indexes: [...existingIndexes],
    createIndexes: jest.fn().mockResolvedValue(undefined),
    indexes: jest.fn().mockImplementation(async () => col._indexes),
    createIndex: jest.fn().mockResolvedValue(undefined),
    dropIndex: jest.fn().mockResolvedValue(undefined),
  };
  mockCollections[name] = col;
  return col;
}

jest.mock('mongoose', () => ({
  connection: {
    get db() {
      return {
        collection: (name) => mockCollections[name] || mockMakeCollection(name),
      };
    },
  },
}));

const createIndexes = require('../config/indexes');

function resetCollections(businessesIndexes = []) {
  for (const key of Object.keys(mockCollections)) delete mockCollections[key];
  mockMakeCollection('businesses', businessesIndexes);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetCollections();
});

describe('businesses.whatsappPhoneNumberId — DB-level uniqueness invariant', () => {
  test('creates a UNIQUE index (not merely a sparse one) on whatsappPhoneNumberId', async () => {
    await createIndexes();

    const [keySpec, options] = mockCollections.businesses.createIndex.mock.calls[0];
    expect(keySpec).toEqual({ whatsappPhoneNumberId: 1 });
    expect(options.unique).toBe(true);
  });

  test('scopes uniqueness with a partialFilterExpression so businesses with no WhatsApp connection do not collide', async () => {
    await createIndexes();

    const [, options] = mockCollections.businesses.createIndex.mock.calls[0];
    expect(options.partialFilterExpression).toEqual({ whatsappPhoneNumberId: { $type: 'string' } });
    // A bare `sparse` index would not enforce uniqueness at all — that was
    // the original bug. Make sure we didn't regress to it.
    expect(options.sparse).toBeUndefined();
  });

  test('drops an outdated non-unique index on the same key before creating the new one', async () => {
    // Simulates the previously deployed index: { whatsappPhoneNumberId: 1 }, sparse, NOT unique.
    resetCollections([
      { name: '_id_', key: { _id: 1 } },
      { name: 'whatsappPhoneNumberId_1', key: { whatsappPhoneNumberId: 1 }, sparse: true },
    ]);

    await createIndexes();

    expect(mockCollections.businesses.dropIndex).toHaveBeenCalledWith('whatsappPhoneNumberId_1');
    expect(mockCollections.businesses.createIndex).toHaveBeenCalled();
    // Order matters: the drop must happen before the create, or MongoDB
    // rejects the new spec with an options conflict.
    const dropOrder = mockCollections.businesses.dropIndex.mock.invocationCallOrder[0];
    const createOrder = mockCollections.businesses.createIndex.mock.invocationCallOrder[0];
    expect(dropOrder).toBeLessThan(createOrder);
  });

  test('does not drop the correct index when it is already in place (idempotent on redeploy)', async () => {
    resetCollections([
      { name: '_id_', key: { _id: 1 } },
      {
        name: 'whatsappPhoneNumberId_unique_partial',
        key: { whatsappPhoneNumberId: 1 },
        unique: true,
        partialFilterExpression: { whatsappPhoneNumberId: { $type: 'string' } },
      },
    ]);

    await createIndexes();

    expect(mockCollections.businesses.dropIndex).not.toHaveBeenCalled();
    expect(mockCollections.businesses.createIndex).toHaveBeenCalled();
  });

  test('leaves unrelated compound indexes on other fields alone', async () => {
    resetCollections([
      { name: '_id_', key: { _id: 1 } },
      { name: 'owner_1', key: { owner: 1 }, unique: true },
      { name: 'whatsappPhoneNumberId_1_owner_1', key: { whatsappPhoneNumberId: 1, owner: 1 } },
    ]);

    await createIndexes();

    // Only a single-key index on whatsappPhoneNumberId should ever be dropped.
    expect(mockCollections.businesses.dropIndex).not.toHaveBeenCalled();
  });
});
