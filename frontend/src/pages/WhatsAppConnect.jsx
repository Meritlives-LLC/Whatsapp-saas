import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, AlertTriangle, RefreshCw, LogOut,
  Phone, Wifi, WifiOff, MessageCircle, Zap, Shield,
} from 'lucide-react';
import api from '../utils/api';

const META_APP_ID    = import.meta.env.VITE_META_APP_ID   || '';
const META_CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID || '';

// ─── Facebook JS SDK loader ───────────────────────────────────────────────────
function loadFbSdk(appId) {
  return new Promise((resolve) => {
    if (window.FB) { resolve(window.FB); return; }

    window.fbAsyncInit = () => {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: 'v21.0' });
      resolve(window.FB);
    };

    if (!document.getElementById('facebook-jssdk')) {
      const s = document.createElement('script');
      s.id  = 'facebook-jssdk';
      s.src = 'https://connect.facebook.net/en_US/sdk.js';
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
    }
  });
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WhatsAppConnect() {
  // status: idle | connecting | pick_phone | connected | error
  const [status,         setStatus]         = useState('idle');
  const [errorMsg,       setErrorMsg]       = useState('');
  const [connectedPhone, setConnectedPhone] = useState('');
  const [phonePicker,    setPhonePicker]    = useState(null);   // { token, phones[] }
  const [pickLoading,    setPickLoading]    = useState(false);

  // ── On mount: parse redirect params or check existing token ──────────────
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.toString()) window.history.replaceState({}, '', window.location.pathname);

    const ERR_MAP = {
      denied:           'You cancelled the Facebook login. No changes were made.',
      no_phone_numbers: 'No WhatsApp Business numbers found on your Facebook account. Make sure you have a WhatsApp Business Account set up.',
      token_exchange:   `Meta returned an error: ${p.get('detail') || 'unknown'}. Please try again.`,
      invalid_state:    'Security check failed. Please try again.',
      invalid_callback: 'Something went wrong with the Facebook redirect. Please try again.',
    };

    if (p.get('error')) {
      setStatus('error');
      setErrorMsg(ERR_MAP[p.get('error')] || `Something went wrong (${p.get('error')}). Please try again.`);
      return;
    }
    if (p.get('success') === 'true') {
      setStatus('connected');
      setConnectedPhone(decodeURIComponent(p.get('phone') || ''));
      return;
    }
    if (p.get('step') === 'pick_phone' && p.get('data')) {
      try {
        setPhonePicker(JSON.parse(decodeURIComponent(p.get('data'))));
        setStatus('pick_phone');
      } catch {
        setStatus('error');
        setErrorMsg('Could not read phone list from Facebook. Please try again.');
      }
      return;
    }

    // Default: check if already connected
    checkConnection();
  }, []);

  const checkConnection = useCallback(async () => {
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

  // ── Connect button ────────────────────────────────────────────────────────
  const connect = async () => {
    setStatus('connecting');

    // Path A — Embedded Signup popup (best UX, zero technical knowledge needed)
    if (META_APP_ID && META_CONFIG_ID) {
      try {
        const FB = await loadFbSdk(META_APP_ID);
        FB.login(
          (resp) => {
            if (resp.authResponse) {
              // Hand code to backend — same callback URL as the redirect flow
              const code  = resp.authResponse.code || '';
              const state = resp.authResponse.state || 'embedded';
              window.location.href =
                `${import.meta.env.VITE_API_URL || ''}/api/meta/oauth-callback` +
                `?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
            } else {
              setStatus('error');
              setErrorMsg('You closed the Facebook window before completing the connection. Please try again.');
            }
          },
          {
            config_id: META_CONFIG_ID,
            response_type: 'code',
            override_default_response_type: true,
            extras: { setup: {}, sessionInfoVersion: 2 },
          },
        );
        return;
      } catch {
        // FB SDK failed to load — fall through to redirect path
      }
    }

    // Path B — Standard OAuth redirect (fallback / no config_id)
    try {
      const { data } = await api.get('/meta/oauth-url');
      window.location.href = data.url;
    } catch (err) {
      setStatus('error');
      setErrorMsg(
        err.response?.data?.message ||
        'Could not start the connection. Please contact support if this keeps happening.',
      );
    }
  };

  // ── Phone picker (user has multiple WhatsApp numbers) ─────────────────────
  const pickPhone = async (phone) => {
    setPickLoading(true);
    try {
      await api.post('/meta/select-phone', {
        phoneNumberId: phone.phoneNumberId,
        accessToken:   phonePicker.token,
        wabaId:        phone.wabaId,
      });
      setStatus('connected');
      setConnectedPhone(phone.displayNumber);
      setPhonePicker(null);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.message || 'Could not save your selection. Please try again.');
    } finally {
      setPickLoading(false);
    }
  };

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = async () => {
    if (!confirm('Disconnect WhatsApp? Your AI assistant will stop replying to messages.')) return;
    try {
      await api.delete('/meta/disconnect');
      setStatus('idle');
      setConnectedPhone('');
    } catch {
      alert('Could not disconnect. Please try again.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-200 flex-shrink-0">
          <WAIcon />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connect WhatsApp</h1>
          <p className="text-sm text-gray-500">Link your business number in under 2 minutes</p>
        </div>
      </div>

      {/* ── CONNECTED ─────────────────────────────────────────────────────── */}
      {status === 'connected' && (
        <ConnectedState phone={connectedPhone} onDisconnect={disconnect} onRecheck={checkConnection} />
      )}

      {/* ── PHONE PICKER ──────────────────────────────────────────────────── */}
      {status === 'pick_phone' && phonePicker && (
        <PhonePicker phones={phonePicker.phones} onPick={pickPhone} loading={pickLoading} />
      )}

      {/* ── ERROR ─────────────────────────────────────────────────────────── */}
      {status === 'error' && (
        <ErrorState message={errorMsg} onRetry={() => setStatus('idle')} />
      )}

      {/* ── IDLE / CONNECTING ─────────────────────────────────────────────── */}
      {(status === 'idle' || status === 'connecting') && (
        <IdleState onConnect={connect} connecting={status === 'connecting'} />
      )}

    </div>
  );
}

// ─── Idle / CTA state ─────────────────────────────────────────────────────────
function IdleState({ onConnect, connecting }) {
  return (
    <div className="space-y-5">

      {/* Main CTA card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Green banner */}
        <div className="bg-gradient-to-r from-green-500 to-green-400 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <WAIcon size={32} />
          </div>
          <h2 className="text-lg font-bold">One click to connect</h2>
          <p className="text-sm text-green-100 mt-1">
            Facebook guides you through every step — no technical knowledge needed
          </p>
        </div>

        {/* Steps */}
        <div className="p-5 space-y-3">
          {[
            ['A Facebook window opens',             'You\'ll log in or stay logged in — takes seconds'],
            ['Select your WhatsApp Business number', 'Facebook shows your numbers — just pick one'],
            ['Grant messaging permission',           'Tap "Allow" — we only get access to reply to messages'],
            ['Done! AI replies start immediately',   'Customers message you, AI answers 24/7'],
          ].map(([title, desc], i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{title}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA button */}
        <div className="px-5 pb-5">
          <button
            onClick={onConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-[#1877F2] hover:bg-[#166FE5] active:scale-[0.98] text-white rounded-2xl text-base font-bold transition-all shadow-lg shadow-blue-200 disabled:opacity-60"
          >
            {connecting ? (
              <><RefreshCw size={20} className="animate-spin" /> Opening Facebook…</>
            ) : (
              <><FBIcon /><span>Connect with Facebook</span></>
            )}
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            🔒 Secure · Your customers' messages stay private · Disconnect anytime
          </p>
        </div>
      </div>

      {/* Trust badges */}
      <div className="grid grid-cols-3 gap-3">
        {[
          [Shield,        'Secure',       'Bank-level OAuth — we never see your Facebook password'],
          [Zap,           'Instant',      'AI starts replying the moment you connect'],
          [MessageCircle, '24/7 replies', 'Never miss a customer message again'],
        ].map(([Icon, label, desc]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
            <Icon size={18} className="text-green-500 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-gray-800">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-tight">{desc}</p>
          </div>
        ))}
      </div>

      {/* Need a WhatsApp Business account? */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-900 mb-1">
          Don't have a WhatsApp Business account yet?
        </p>
        <p className="text-xs text-amber-800 leading-relaxed">
          No problem — during the Facebook flow, you'll get the option to create one for free.
          All you need is a phone number that can receive an SMS verification code.
        </p>
      </div>

    </div>
  );
}

// ─── Connected state ──────────────────────────────────────────────────────────
function ConnectedState({ phone, onDisconnect, onRecheck }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center">
              <Wifi size={22} className="text-green-600" />
            </div>
            <div>
              <p className="font-bold text-green-900 text-lg">WhatsApp Connected ✓</p>
              {phone && <p className="text-sm text-green-700 font-mono">{phone}</p>}
              <p className="text-xs text-green-600 mt-0.5">AI auto-replies are active</p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={onRecheck}
              title="Re-check connection"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
          <p className="text-sm text-green-800 leading-relaxed">
            🎉 <strong>You're all set!</strong> Send a test message to your WhatsApp number and the AI
            will reply automatically. Check the <strong>Conversations</strong> tab to watch messages
            come in live.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Phone picker (multiple numbers found) ────────────────────────────────────
function PhonePicker({ phones, onPick, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-bold text-gray-900 text-lg mb-1">Which number should we use?</h2>
      <p className="text-sm text-gray-500 mb-5">
        We found {phones.length} WhatsApp numbers on your account. Pick the one you want customers to message.
      </p>
      <div className="space-y-3">
        {phones.map((phone) => (
          <button
            key={phone.phoneNumberId}
            onClick={() => onPick(phone)}
            disabled={loading}
            className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 rounded-xl text-left transition-all disabled:opacity-60 group"
          >
            <div className="w-10 h-10 bg-gray-100 group-hover:bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
              <Phone size={18} className="text-gray-500 group-hover:text-green-600 transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-base">{phone.displayNumber}</p>
              <p className="text-xs text-gray-500 truncate">{phone.verifiedName} · {phone.wabaName}</p>
            </div>
            {loading
              ? <RefreshCw size={16} className="animate-spin text-gray-400" />
              : <CheckCircle size={18} className="text-gray-300 group-hover:text-green-500 transition-colors" />
            }
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <WifiOff size={20} className="text-red-500" />
        </div>
        <div>
          <p className="font-bold text-red-900 mb-1">Connection didn't complete</p>
          <p className="text-sm text-red-700 leading-relaxed">{message}</p>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition-colors"
      >
        <RefreshCw size={15} /> Try Again
      </button>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function WAIcon({ size = 24, color = 'white' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.845L.057 23.571a.75.75 0 00.918.919l5.733-1.472A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.7-.503-5.257-1.39l-.374-.214-3.898 1.001.99-3.892-.228-.38A9.961 9.961 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  );
}

function FBIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.027 4.388 11.024 10.125 11.927v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796v8.437C19.612 23.097 24 18.1 24 12.073z"/>
    </svg>
  );
}




