// frontend/src/pages/WhatsAppConnect.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, ExternalLink, Wifi, WifiOff,
  RefreshCw, LogOut, ChevronDown, Phone, AlertCircle,
} from 'lucide-react';
import api from '../utils/api';

const HAS_META_APP = !!import.meta.env.META_APP_ID;

export default function WhatsAppConnect() {
  const [status, setStatus]                 = useState('idle');
  const [errorMsg, setErrorMsg]             = useState('');
  const [connectedPhone, setConnectedPhone] = useState('');
  const [oauthLoading, setOauthLoading]     = useState(false);
  const [phonePicker, setPhonePicker]       = useState(null);
  const [pickerLoading, setPickerLoading]   = useState(false);

  useEffect(() => {
    const params       = new URLSearchParams(window.location.search);
    const successParam = params.get('success');
    const errorParam   = params.get('error');
    const phoneParam   = params.get('phone');
    const stepParam    = params.get('step');
    const dataParam    = params.get('data');

    if (params.toString()) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (errorParam) {
      const messages = {
        denied:           'You declined the Facebook permission request. Please try again and click Allow.',
        no_phone_numbers: 'No WhatsApp Business phone numbers found on your Meta account.',
        token_exchange:   `Meta connection failed: ${params.get('detail') || 'unknown error'}`,
        invalid_state:    'Security check failed. Please try again.',
        invalid_callback: 'Something went wrong with the Facebook redirect. Please try again.',
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
        setPhonePicker(JSON.parse(decodeURIComponent(dataParam)));
        setStatus('pick_phone');
      } catch {
        setStatus('error');
        setErrorMsg('Failed to read phone list from Meta. Please try again.');
      }
      return;
    }

    checkTokenStatus();
  }, []);

  const checkTokenStatus = useCallback(async () => {
    setStatus('loading');
    try {
      const { data } = await api.get('/meta/token-status');
      setStatus(data.connected ? 'connected' : 'idle');
      if (data.connected) setConnectedPhone(data.phone || '');
    } catch {
      setStatus('idle');
    }
  }, []);

  const startOAuth = async () => {
    if (!HAS_META_APP) {
      setStatus('error');
      setErrorMsg('WhatsApp login is not configured yet. Please contact support.');
      return;
    }
    setOauthLoading(true);
    try {
      const { data } = await api.get('/meta/oauth-url');
      window.location.href = data.url;
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.message || 'Failed to start login. Please try again.');
      setOauthLoading(false);
    }
  };

  const selectPhone = async (phone) => {
    setPickerLoading(true);
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
      setErrorMsg(err.response?.data?.message || 'Failed to save phone. Please try again.');
    } finally {
      setPickerLoading(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect WhatsApp? AI auto-replies will stop until you reconnect.')) return;
    try {
      await api.delete('/meta/disconnect');
      setStatus('idle');
      setConnectedPhone('');
    } catch {
      alert('Failed to disconnect. Please try again.');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 bg-green-500 rounded-2xl flex items-center justify-center">
          <WhatsAppIcon />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Connect WhatsApp</h1>
          <p className="text-sm text-gray-400">Takes less than 2 minutes</p>
        </div>
      </div>

      {/* ── CONNECTED ── */}
      {status === 'connected' && (
        <div className="bg-white rounded-2xl border border-green-200 p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Wifi size={20} className="text-green-600" />
            </div>
            <div>
              <p className="font-bold text-green-900">WhatsApp Connected ✓</p>
              {connectedPhone && <p className="text-sm text-green-700 font-mono">{connectedPhone}</p>}
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 mb-4 text-sm text-green-800">
            🎉 Your AI is live! Send a WhatsApp message to your number to test it.
            Check the <strong>Conversations</strong> tab to see replies in real time.
          </div>
          <div className="flex gap-2">
            <button onClick={checkTokenStatus}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} /> Re-check
            </button>
            <button onClick={disconnect}
              className="flex items-center gap-1.5 px-4 py-2 border border-red-200 rounded-xl text-sm text-red-600 hover:bg-red-50 transition-colors">
              <LogOut size={14} /> Disconnect
            </button>
          </div>
        </div>
      )}

      {/* ── PHONE PICKER ── */}
      {status === 'pick_phone' && phonePicker && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-1">Choose a WhatsApp Number</h2>
          <p className="text-sm text-gray-500 mb-4">We found multiple numbers. Which one should the AI use?</p>
          <div className="space-y-3">
            {phonePicker.phones.map((phone) => (
              <button key={phone.phoneNumberId} onClick={() => selectPhone(phone)} disabled={pickerLoading}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 hover:border-green-400 hover:bg-green-50 rounded-xl text-left transition-all disabled:opacity-60">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone size={18} className="text-gray-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{phone.displayNumber}</p>
                  <p className="text-xs text-gray-400">{phone.verifiedName} · {phone.wabaName}</p>
                </div>
                {pickerLoading && <RefreshCw size={16} className="animate-spin ml-auto text-gray-400" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {status === 'error' && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <WifiOff size={20} className="text-red-500" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-red-900 mb-1">Connection Failed</p>
              <p className="text-sm text-red-700 mb-3">{errorMsg}</p>
              <button onClick={() => setStatus('idle')}
                className="px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors">
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IDLE / LOADING ── */}
      {(status === 'idle' || status === 'loading') && (
        <div className="space-y-4">

          {/* Main connect card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            {status === 'loading' ? (
              <div className="py-6">
                <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Checking connection status...</p>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <WhatsAppIcon size={28} color="#25D366" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Connect with Facebook</h2>
                <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                  One click — Facebook asks permission, you approve, done. No copy-pasting tokens.
                </p>

                <button onClick={startOAuth} disabled={oauthLoading}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-xl text-base font-semibold transition-all disabled:opacity-60 mb-4">
                  {oauthLoading
                    ? <><RefreshCw size={18} className="animate-spin" /> Redirecting to Facebook…</>
                    : <><FacebookIcon /> Continue with Facebook</>
                  }
                </button>

                {/* Inline steps — always visible, no accordion */}
                <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2.5">
                  {[
                    'You\'re taken to Facebook',
                    'Facebook asks: "Allow access to your WhatsApp?"',
                    'You click Allow',
                    'You\'re brought back here — connected ✓',
                  ].map((text, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <span className="w-5 h-5 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-600">{text}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Requirements — open by default so users know what they need */}
          <RequirementsCard />
        </div>
      )}
    </div>
  );
}

function RequirementsCard() {
  const [open, setOpen] = useState(true);
  const items = [
    { label: 'A Facebook / Meta account', done: true },
    { label: 'A WhatsApp Business Account (WABA)', done: false, link: 'https://business.facebook.com', linkText: 'Create one' },
    { label: 'A verified phone number in your WABA', done: false },
    { label: 'WhatsApp product added to your Meta App', done: false, link: 'https://developers.facebook.com', linkText: 'Go to Meta' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
        <span className="flex items-center gap-2">
          <AlertCircle size={15} className="text-amber-500" />
          Before you connect — checklist
        </span>
        <ChevronDown size={15} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 space-y-3 border-t border-gray-50">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 pt-3">
              <span className={`text-lg flex-shrink-0 ${item.done ? 'text-green-500' : 'text-gray-300'}`}>
                {item.done ? '✓' : '○'}
              </span>
              <span className="text-sm text-gray-600 flex-1">{item.label}</span>
              {item.link && (
                <a href={item.link} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 flex-shrink-0">
                  {item.linkText} <ExternalLink size={10} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.027 4.388 11.024 10.125 11.927v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796v8.437C19.612 23.097 24 18.1 24 12.073z" />
    </svg>
  );
}
