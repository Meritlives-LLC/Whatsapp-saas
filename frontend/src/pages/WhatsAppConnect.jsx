// frontend/src/pages/WhatsAppConnect.jsx
// Replaces the manual 6-step form with a one-click Meta OAuth flow.
// Falls back to manual entry if META_APP_ID is not configured.

import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, AlertTriangle, ExternalLink, Wifi, WifiOff,
  RefreshCw, LogOut, ChevronDown, Phone,
} from 'lucide-react';
import api from '../utils/api';

// ─── Config ───────────────────────────────────────────────────────────────────
const HAS_META_APP = !!import.meta.env.VITE_META_APP_ID;   // set in .env.local

// ─── Main component ───────────────────────────────────────────────────────────
export default function WhatsAppConnect() {
  const [status, setStatus]         = useState('idle');   // idle | loading | connected | error
  const [errorMsg, setErrorMsg]     = useState('');
  const [connectedPhone, setConnectedPhone] = useState('');
  const [oauthLoading, setOauthLoading]     = useState(false);

  // Multi-phone picker (when user has >1 WhatsApp number)
  const [phonePicker, setPhonePicker] = useState(null);   // { token, phones }
  const [pickerLoading, setPickerLoading] = useState(false);

  // Check token status on mount + handle OAuth redirect params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const successParam = params.get('success');
    const errorParam   = params.get('error');
    const phoneParam   = params.get('phone');
    const stepParam    = params.get('step');
    const dataParam    = params.get('data');

    // Clean URL
    if (params.toString()) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (errorParam) {
      const messages = {
        denied: 'You declined the permission request on Facebook.',
        no_phone_numbers: 'No WhatsApp Business phone numbers found on your Meta account. Make sure you have a WhatsApp Business Account.',
        token_exchange:   `Meta token exchange failed: ${params.get('detail') || 'unknown error'}`,
        invalid_state:    'Security check failed. Please try again.',
        invalid_callback: 'Invalid callback from Meta. Please try again.',
      };
      setStatus('error');
      setErrorMsg(messages[errorParam] || `Something went wrong (${errorParam})`);
      return;
    }

    if (successParam === 'true') {
      setStatus('connected');
      setConnectedPhone(decodeURIComponent(phoneParam || ''));
      return;
    }

    if (stepParam === 'pick_phone' && dataParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(dataParam));
        setPhonePicker(parsed);
        setStatus('pick_phone');
      } catch {
        setStatus('error');
        setErrorMsg('Failed to parse phone list from Meta. Please try again.');
      }
      return;
    }

    // Default: check existing token
    checkTokenStatus();
  }, []);

  const checkTokenStatus = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await api.get('/meta/token-status');
      if (data.connected) {
        setStatus('connected');
        setConnectedPhone(data.phone || '');
      } else {
        setStatus('idle');
      }
    } catch {
      setStatus('idle');
    }
  }, []);

  // ── Kick off Meta OAuth ──────────────────────────────────────────────────────
  const startOAuth = async () => {
    setOauthLoading(true);
    try {
      const { data } = await api.get('/meta/oauth-url');
      // Redirect the whole page to Meta — user will come back to /whatsapp-connect
      window.location.href = data.url;
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.message || 'Failed to start login. Is META_APP_ID set on the server?');
      setOauthLoading(false);
    }
  };

  // ── User picks one phone from the list ──────────────────────────────────────
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
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.message || 'Failed to save phone. Please try again.');
    } finally {
      setPickerLoading(false);
    }
  };

  // ── Disconnect ───────────────────────────────────────────────────────────────
  const disconnect = async () => {
    if (!confirm('Disconnect WhatsApp? AI auto-replies will stop.')) return;
    try {
      await api.delete('/meta/disconnect');
      setStatus('idle');
      setConnectedPhone('');
    } catch {
      alert('Failed to disconnect. Please try again.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-200">
          <WhatsAppIcon />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Start AI Automation</h1>
          <p className="text-sm text-gray-500">Link your WhatsApp Business number via Facebook Login</p>
        </div>
      </div>

      {/* ── CONNECTED ── */}
      {status === 'connected' && (
        <ConnectedCard phone={connectedPhone} onDisconnect={disconnect} onRecheck={checkTokenStatus} />
      )}

      {/* ── PHONE PICKER ── */}
      {status === 'pick_phone' && phonePicker && (
        <PhonePicker phones={phonePicker.phones} onSelect={selectPhone} loading={pickerLoading} />
      )}

      {/* ── ERROR ── */}
      {status === 'error' && (
        <ErrorCard message={errorMsg} onRetry={() => setStatus('idle')} />
      )}

      {/* ── IDLE / CTA ── */}
      {(status === 'idle' || status === 'loading') && (
        <div className="space-y-6">
          {/* One-click connect card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <WhatsAppIcon size={32} color="#25D366" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Connect with Facebook Login
            </h2>
            <p className="text-sm text-gray-500 mb-8 max-w-sm mx-auto leading-relaxed">
              Click below to securely link your WhatsApp Business account.
              You'll be taken to Facebook, grant permission, and land back here — connected.
            </p>

            <button
              onClick={startOAuth}
              disabled={oauthLoading || status === 'loading'}
              className="w-full max-w-xs mx-auto flex items-center justify-center gap-3 px-6 py-3.5 bg-[#1877F2] hover:bg-[#166FE5] active:bg-[#1566D6] text-white rounded-2xl text-base font-semibold transition-all shadow-md shadow-blue-200 disabled:opacity-60"
            >
              {oauthLoading ? (
                <><RefreshCw size={18} className="animate-spin" /> Redirecting to Facebook…</>
              ) : (
                <><FacebookIcon /> Continue with Facebook</>
              )}
            </button>

            {/* What happens explainer */}
            <div className="mt-8 text-left bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">What happens when you click:</p>
              {[
                ['1', "You're sent to Facebook / Meta"],
                ['2', 'Facebook asks: "Allow this app to access your WhatsApp Business account?"'],
                ['3', 'You click Allow'],
                ['4', 'Facebook gives us a secure token'],
                ['5', 'We save it — WhatsApp is connected ✓'],
              ].map(([n, text]) => (
                <div key={n} className="flex gap-3 items-start">
                  <span className="w-5 h-5 bg-white border border-gray-200 rounded-full flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">{n}</span>
                  <span className="text-sm text-gray-600">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Permissions info */}
          <PermissionsInfo />

          {/* Prerequisites */}
          <PrerequisitesCard />
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConnectedCard({ phone, onDisconnect, onRecheck }) {
  return (
    <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Wifi size={20} className="text-green-600" />
          </div>
          <div>
            <p className="font-bold text-green-900">WhatsApp Connected</p>
            {phone && <p className="text-sm text-green-700 font-mono">{phone}</p>}
            <p className="text-xs text-green-600 mt-0.5">AI auto-replies are active</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onRecheck}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Re-check connection"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={onDisconnect}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
          >
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      </div>

      <div className="mt-5 p-4 bg-green-50 rounded-xl">
        <p className="text-sm text-green-800">
          🎉 You're all set! Send a message to your WhatsApp number and the AI will reply automatically.
          Check the <strong>Conversations</strong> tab to see incoming messages live.
        </p>
      </div>
    </div>
  );
}

function PhonePicker({ phones, onSelect, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-bold text-gray-900 text-lg mb-1">Choose a WhatsApp Number</h2>
      <p className="text-sm text-gray-500 mb-5">We found multiple WhatsApp numbers on your account. Which one should receive AI replies?</p>
      <div className="space-y-3">
        {phones.map((phone) => (
          <button
            key={phone.phoneNumberId}
            onClick={() => onSelect(phone)}
            disabled={loading}
            className="w-full flex items-center gap-4 p-4 border border-gray-200 hover:border-green-400 hover:bg-green-50 rounded-xl text-left transition-all disabled:opacity-60"
          >
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Phone size={18} className="text-gray-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{phone.displayNumber}</p>
              <p className="text-xs text-gray-500">{phone.verifiedName} · WABA: {phone.wabaName}</p>
            </div>
            {loading && <RefreshCw size={16} className="animate-spin ml-auto text-gray-400" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function ErrorCard({ message, onRetry }) {
  return (
    <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <WifiOff size={20} className="text-red-500" />
        </div>
        <div>
          <p className="font-bold text-red-900">Connection Failed</p>
          <p className="text-sm text-red-700">{message}</p>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

function PermissionsInfo() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-blue-900 mb-2">🔐 Permissions we request:</p>
      <ul className="space-y-1.5">
        {[
          ['whatsapp_business_messaging', 'Send and receive WhatsApp messages on your behalf'],
          ['whatsapp_business_management', 'Read your WhatsApp Business Account settings'],
          ['business_management', 'Read your Meta Business Suite account info'],
        ].map(([perm, desc]) => (
          <li key={perm} className="flex gap-2 text-xs text-blue-800">
            <CheckCircle size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <span><code className="font-mono bg-blue-100 px-1 rounded">{perm}</code> — {desc}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrerequisitesCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        Prerequisites checklist
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 py-3 space-y-2 text-sm text-gray-700 bg-white">
          {[
            ['You have a Facebook account', true],
            ['You have a Meta Developer App (Business type)', false,
              <a key="link" href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-blue-600 underline flex items-center gap-1">Create one <ExternalLink size={11} /></a>],
            ['WhatsApp product added to your Meta app', false],
            ['Your Meta app has a WhatsApp Business Account linked', false],
            ['At least one phone number in your WhatsApp Business Account', false],
          ].map(([label, done, extra], i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className={`text-base flex-shrink-0 ${done ? 'text-green-500' : 'text-gray-300'}`}>
                {done ? '✓' : '○'}
              </span>
              <span>{label}{extra && <> — {extra}</>}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function WhatsAppIcon({ size = 22, color = 'white' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.845L.057 23.571a.75.75 0 00.918.919l5.733-1.472A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.7-.503-5.257-1.39l-.374-.214-3.898 1.001.99-3.892-.228-.38A9.961 9.961 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.027 4.388 11.024 10.125 11.927v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796v8.437C19.612 23.097 24 18.1 24 12.073z" />
    </svg>
  );
}
