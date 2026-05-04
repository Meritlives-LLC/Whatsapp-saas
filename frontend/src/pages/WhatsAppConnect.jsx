// frontend/src/pages/WhatsAppConnect.jsx
// One-click Meta OAuth flow with fallback manual mode

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, ExternalLink, Wifi, WifiOff,
  RefreshCw, LogOut, ChevronDown, Phone,
} from 'lucide-react';
import api from '../utils/api';

// ─── Config ───────────────────────────────────────────────────────────────────
const HAS_META_APP = !!import.meta.env.VITE_META_APP_ID;

// ─── Main component ───────────────────────────────────────────────────────────
export default function WhatsAppConnect() {
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [connectedPhone, setConnectedPhone] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);

  const [phonePicker, setPhonePicker] = useState(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  // ── INIT / OAuth callback handler ───────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const successParam = params.get('success');
    const errorParam = params.get('error');
    const phoneParam = params.get('phone');
    const stepParam = params.get('step');
    const dataParam = params.get('data');

    if (params.toString()) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (errorParam) {
      const messages = {
        denied: 'Permission was denied on Facebook.',
        no_phone_numbers: 'No WhatsApp Business numbers found.',
        token_exchange: 'Token exchange failed.',
        invalid_state: 'Security validation failed.',
        invalid_callback: 'Invalid callback received.',
      };

      setStatus('error');
      setErrorMsg(messages[errorParam] || 'Unknown error occurred');
      return;
    }

    if (successParam === 'true') {
      setStatus('connected');
      setConnectedPhone(decodeURIComponent(phoneParam || ''));
      return;
    }

    if (stepParam === 'pick_phone' && dataParam) {
      try {
        setPhonePicker(JSON.parse(decodeURIComponent(dataParam)));
        setStatus('pick_phone');
      } catch {
        setStatus('error');
        setErrorMsg('Failed to load phone selection.');
      }
      return;
    }

    checkTokenStatus();
  }, []);

  // ── Check existing connection ───────────────────────────────────────────────
  const checkTokenStatus = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await api.get('/meta/token-status');

      if (data?.connected) {
        setStatus('connected');
        setConnectedPhone(data.phone || '');
      } else {
        setStatus('idle');
      }
    } catch {
      setStatus('idle');
    }
  }, []);

  // ── OAuth flow ──────────────────────────────────────────────────────────────
  const startOAuth = async () => {
    if (!HAS_META_APP) {
      setStatus('error');
      setErrorMsg('Meta App ID not configured. Use manual setup or add VITE_META_APP_ID.');
      return;
    }

    setOauthLoading(true);

    try {
      const { data } = await api.get('/meta/oauth-url');
      window.location.href = data.url;
    } catch (err) {
      setOauthLoading(false);
      setStatus('error');
      setErrorMsg(err.response?.data?.message || 'Failed to start OAuth');
    }
  };

  // ── Select phone ────────────────────────────────────────────────────────────
  const selectPhone = async (phone) => {
    setPickerLoading(true);
    try {
      await api.post('/meta/select-phone', {
        phoneNumberId: phone.phoneNumberId,
        accessToken: phonePicker.token,
        wabaId: phone.wabaId,
      });

      setStatus('connected');
      setConnectedPhone(phone.displayNumber);
      setPhonePicker(null);
    } catch {
      setStatus('error');
      setErrorMsg('Failed to save selected phone.');
    } finally {
      setPickerLoading(false);
    }
  };

  // ── Disconnect ──────────────────────────────────────────────────────────────
  const disconnect = async () => {
    if (!confirm('Disconnect WhatsApp?')) return;

    try {
      await api.delete('/meta/disconnect');
      setStatus('idle');
      setConnectedPhone('');
    } catch {
      alert('Failed to disconnect');
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 bg-green-500 rounded-2xl flex items-center justify-center">
          <WhatsAppIcon />
        </div>
        <div>
          <h1 className="text-2xl font-bold">WhatsApp Automation</h1>
          <p className="text-sm text-gray-500">
            Connect your WhatsApp Business account
          </p>
        </div>
      </div>

      {/* ERROR */}
      {status === 'error' && (
        <ErrorCard message={errorMsg} onRetry={() => setStatus('idle')} />
      )}

      {/* CONNECTED */}
      {status === 'connected' && (
        <ConnectedCard
          phone={connectedPhone}
          onDisconnect={disconnect}
          onRecheck={checkTokenStatus}
        />
      )}

      {/* PHONE PICKER */}
      {status === 'pick_phone' && phonePicker && (
        <PhonePicker
          phones={phonePicker.phones}
          onSelect={selectPhone}
          loading={pickerLoading}
        />
      )}

      {/* IDLE */}
      {(status === 'idle' || status === 'loading') && (
        <div className="bg-white p-8 rounded-2xl border text-center">

          <div className="mb-4">
            <WhatsAppIcon size={40} color="#25D366" />
          </div>

          <h2 className="text-xl font-bold mb-2">
            Connect WhatsApp
          </h2>

          <p className="text-gray-500 mb-6">
            One-click connection via Meta OAuth
          </p>

          {/* OAuth Button */}
          <button
            onClick={startOAuth}
            disabled={oauthLoading}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl w-full font-semibold"
          >
            {oauthLoading ? 'Redirecting...' : 'Continue with Facebook'}
          </button>

          {/* Fallback */}
          {!HAS_META_APP && (
            <div className="mt-4 text-sm text-red-600">
              Meta App not configured — add VITE_META_APP_ID
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── UI Components ───────────────────────────────────────────────────────────

function ConnectedCard({ phone, onDisconnect, onRecheck }) {
  return (
    <div className="p-6 bg-green-50 rounded-2xl border">
      <div className="flex justify-between">
        <div>
          <p className="font-bold">Connected</p>
          <p className="text-sm">{phone}</p>
        </div>
        <button onClick={onDisconnect}>
          <LogOut />
        </button>
      </div>
    </div>
  );
}

function PhonePicker({ phones, onSelect, loading }) {
  return (
    <div className="p-6 border rounded-2xl">
      <h2 className="font-bold mb-4">Choose Number</h2>
      {phones?.map(p => (
        <button
          key={p.phoneNumberId}
          onClick={() => onSelect(p)}
          className="block w-full text-left p-3 border mb-2 rounded"
        >
          {p.displayNumber}
        </button>
      ))}
    </div>
  );
}

function ErrorCard({ message, onRetry }) {
  return (
    <div className="p-4 bg-red-50 border rounded-xl">
      <p className="text-red-600">{message}</p>
      <button onClick={onRetry} className="mt-2 underline">
        Try again
      </button>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────
function WhatsAppIcon({ size = 24, color = 'white' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 0C5.4 0 0 5.4 0 12c0 2.1.6 4.1 1.5 5.8L0 24l6.3-1.6C8 23.4 10 24 12 24c6.6 0 12-5.4 12-12S18.6 0 12 0z"/>
    </svg>
  );
}
