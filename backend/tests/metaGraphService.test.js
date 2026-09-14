jest.mock('axios');
const axios = require('axios');

process.env.META_APP_ID = 'test-app-id';
process.env.META_APP_SECRET = 'test-app-secret';
process.env.META_GRAPH_API_VERSION = 'v23.0';

// Required once, after the env vars above are set, since config/meta.js
// reads META_GRAPH_API_VERSION at module-load time.
const service = require('../services/metaGraphService');

beforeEach(() => {
  jest.clearAllMocks();
});

function loadService() {
  return service;
}

describe('metaGraphService', () => {
  test('exchangeEmbeddedCodeForToken does NOT send redirect_uri (Embedded Signup is not a redirect flow)', async () => {
    axios.get.mockResolvedValueOnce({ data: { access_token: 'short-lived-token' } });
    const { exchangeEmbeddedCodeForToken } = loadService();

    const token = await exchangeEmbeddedCodeForToken('the-code');

    expect(token).toBe('short-lived-token');
    const [url, config] = axios.get.mock.calls[0];
    expect(url).toContain('/oauth/access_token');
    expect(url).toContain('v23.0');
    expect(config.params).toEqual({
      client_id: 'test-app-id',
      client_secret: 'test-app-secret',
      code: 'the-code',
    });
    expect(config.params.redirect_uri).toBeUndefined();
  });

  test('exchangeCodeForToken (classic redirect flow) DOES send a matching redirect_uri', async () => {
    axios.get.mockResolvedValueOnce({ data: { access_token: 'short-lived-token' } });
    const { exchangeCodeForToken } = loadService();

    await exchangeCodeForToken({ code: 'the-code', redirectUri: 'https://api.example.com/api/meta/oauth-callback' });

    const [, config] = axios.get.mock.calls[0];
    expect(config.params.redirect_uri).toBe('https://api.example.com/api/meta/oauth-callback');
  });

  test('subscribeAppToWaba resolves with subscribed:false on failure instead of throwing', async () => {
    axios.post.mockRejectedValueOnce({ response: { data: { error: { message: 'Invalid OAuth access token' } } } });
    const { subscribeAppToWaba } = loadService();

    const result = await subscribeAppToWaba('waba-123', 'bad-token');

    expect(result).toEqual({ subscribed: false, error: 'Invalid OAuth access token' });
  });

  test('subscribeAppToWaba resolves with subscribed:true on success', async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true } });
    const { subscribeAppToWaba } = loadService();

    const result = await subscribeAppToWaba('waba-123', 'good-token');

    expect(result).toEqual({ subscribed: true });
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/waba-123/subscribed_apps'),
      null,
      expect.objectContaining({ headers: { Authorization: 'Bearer good-token' } })
    );
  });

  test('registerPhoneNumber resolves with registered:false + error details on failure instead of throwing', async () => {
    axios.post.mockRejectedValueOnce({
      response: { data: { error: { message: 'This number is registered to an existing WhatsApp account', code: 133010 } } },
    });
    const { registerPhoneNumber } = loadService();

    const result = await registerPhoneNumber('phone-123', 'good-token', '123456');

    expect(result.registered).toBe(false);
    expect(result.code).toBe(133010);
  });

  test('registerPhoneNumber sends the pin and messaging_product', async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true } });
    const { registerPhoneNumber } = loadService();

    await registerPhoneNumber('phone-123', 'good-token', '654321');

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/phone-123/register'),
      { messaging_product: 'whatsapp', pin: '654321' },
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer good-token' }) })
    );
  });

  test('getBusinessesAndPhoneNumbers flattens nested businesses/WABAs/phones', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'biz-1',
            whatsapp_business_accounts: {
              data: [
                {
                  id: 'waba-1',
                  name: 'Acme WABA',
                  phone_numbers: {
                    data: [
                      { id: 'phone-1', display_phone_number: '+1 555 0100', verified_name: 'Acme Support' },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    });
    const { getBusinessesAndPhoneNumbers } = loadService();

    const phones = await getBusinessesAndPhoneNumbers('some-token');

    expect(phones).toEqual([
      { phoneNumberId: 'phone-1', displayNumber: '+1 555 0100', verifiedName: 'Acme Support', wabaId: 'waba-1', wabaName: 'Acme WABA' },
    ]);
  });
});
