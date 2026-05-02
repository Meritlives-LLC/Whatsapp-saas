import { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, ExternalLink, Copy, RefreshCw, Wifi, WifiOff, ChevronRight } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  { n: 1, title: 'Create Meta Developer Account',   done: true  },
  { n: 2, title: 'Create a Meta App',               done: false },
  { n: 3, title: 'Add WhatsApp to your app',        done: false },
  { n: 4, title: 'Get your credentials',            done: false },
  { n: 5, title: 'Paste credentials below',         done: false },
  { n: 6, title: 'Set webhook in Meta',             done: false },
];

export default function WhatsAppConnect() {
  const { business } = useAuth();
  const [form, setForm] = useState({
    whatsappPhoneNumberId: '',
    whatsappAccessToken: '',
    whatsappVerifyToken: '',
  });
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [saved, setSaved]       = useState(false);
  const [status, setStatus]     = useState(null); // 'connected' | 'failed' | null
  const [copied, setCopied]     = useState('');
  const [activeStep, setActiveStep] = useState(1);

  // Pre-fill from existing business settings
  useEffect(() => {
    api.get('/business').then(({ data }) => {
      const biz = data.data;
      if (biz.whatsappPhoneNumberId) {
        setForm({
          whatsappPhoneNumberId: biz.whatsappPhoneNumberId || '',
          whatsappAccessToken:   biz.whatsappAccessToken   || '',
          whatsappVerifyToken:   biz.whatsappVerifyToken   || '',
        });
        if (biz.whatsappPhoneNumberId && biz.whatsappAccessToken) {
          setStatus('connected');
          setActiveStep(6);
        }
      }
    }).catch(() => {});
  }, []);

  const backendUrl = `${window.location.origin.replace('3000', '5000')}/api/webhook`;
  // In production the backend URL comes from env
  const webhookUrl = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api/webhook`
    : backendUrl;

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const saveCredentials = async () => {
    if (!form.whatsappPhoneNumberId || !form.whatsappAccessToken || !form.whatsappVerifyToken) {
      alert('Please fill in all 3 fields');
      return;
    }
    setSaving(true);
    try {
      await api.put('/business', form);
      setSaved(true);
      setActiveStep(6);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const { data } = await api.post('/business/test-whatsapp');
      setStatus(data.success ? 'connected' : 'failed');
    } catch {
      // Fallback: just check if the fields are filled
      setStatus(form.whatsappPhoneNumberId && form.whatsappAccessToken ? 'connected' : 'failed');
    } finally {
      setTesting(false);
    }
  };

  const CopyBtn = ({ text, id, label }) => (
    <button onClick={() => copyText(text, id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        copied === id ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
      }`}>
      <Copy size={12} /> {copied === id ? 'Copied!' : label}
    </button>
  );

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.845L.057 23.571a.75.75 0 00.918.919l5.733-1.472A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.9 0-3.7-.503-5.257-1.39l-.374-.214-3.898 1.001.99-3.892-.228-.38A9.961 9.961 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Connect WhatsApp</h1>
            <p className="text-sm text-gray-500">Link your WhatsApp Business number to start AI automation</p>
          </div>
        </div>

        {/* Connection status badge */}
        {status === 'connected' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-xl w-fit">
            <Wifi size={16} /> WhatsApp connected and receiving messages
          </div>
        )}
        {status === 'failed' && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl w-fit">
            <WifiOff size={16} /> Connection failed — check your credentials
          </div>
        )}
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2">
        {[1,2,3,4,5,6].map((n, i) => (
          <div key={n} className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setActiveStep(n)}
              className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
                n < activeStep  ? 'bg-green-500 text-white' :
                n === activeStep ? 'bg-gray-900 text-white' :
                                   'bg-gray-200 text-gray-500'
              }`}>
              {n < activeStep ? '✓' : n}
            </button>
            {i < 5 && <div className={`w-6 md:w-10 h-0.5 ${n < activeStep ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* ── STEP 1 ── */}
      {activeStep === 1 && (
        <StepCard n={1} title="Create a Meta Developer Account" onNext={() => setActiveStep(2)}>
          <p className="text-sm text-gray-600 mb-4">
            You need a free Meta developer account. If you already have a Facebook account, you can use that.
          </p>
          <a href="https://developers.facebook.com" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors">
            <ExternalLink size={14} /> Open developers.facebook.com
          </a>
          <p className="text-xs text-gray-400 mt-3">Click "Get Started" or "Log In" at the top right of the page.</p>
        </StepCard>
      )}

      {/* ── STEP 2 ── */}
      {activeStep === 2 && (
        <StepCard n={2} title="Create a Meta App" onNext={() => setActiveStep(3)} onBack={() => setActiveStep(1)}>
          <ol className="space-y-3 text-sm text-gray-600">
            <Li n="1">In the Meta developer dashboard, click <strong>"My Apps"</strong> → <strong>"Create App"</strong></Li>
            <Li n="2">When asked "What do you want your app to do?" select <strong>"Other"</strong></Li>
            <Li n="3">For app type, select <strong>"Business"</strong></Li>
            <Li n="4">Give your app a name (e.g. <em>"{business?.name || 'My Business'} Bot"</em>) and click <strong>Create App</strong></Li>
          </ol>
          <img src="https://i.imgur.com/placeholder.png" className="hidden" alt="" />
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            💡 The app you create is YOUR platform app. Your customers' WhatsApp numbers connect through it.
          </div>
        </StepCard>
      )}

      {/* ── STEP 3 ── */}
      {activeStep === 3 && (
        <StepCard n={3} title="Add WhatsApp to Your App" onNext={() => setActiveStep(4)} onBack={() => setActiveStep(2)}>
          <ol className="space-y-3 text-sm text-gray-600">
            <Li n="1">Inside your app dashboard, scroll down to find <strong>"WhatsApp"</strong> in the products list</Li>
            <Li n="2">Click <strong>"Set Up"</strong> next to WhatsApp</Li>
            <Li n="3">You'll be asked to connect a <strong>Meta Business Account</strong>. Create one for free if you don't have one.</Li>
            <Li n="4">Once connected, you'll land on the <strong>WhatsApp → API Setup</strong> page</Li>
          </ol>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
            💡 Meta gives you a <strong>free test phone number</strong> to start with. You can add your real business number later under "Phone Numbers".
          </div>
        </StepCard>
      )}

      {/* ── STEP 4 ── */}
      {activeStep === 4 && (
        <StepCard n={4} title="Get Your Credentials" onNext={() => setActiveStep(5)} onBack={() => setActiveStep(3)}>
          <p className="text-sm text-gray-600 mb-4">On the <strong>WhatsApp → API Setup</strong> page, find and copy these 2 values:</p>
          <div className="space-y-3">
            <CredBox
              label="Phone Number ID"
              example="123456789012345"
              hint="Under 'From' section. It's a long number, NOT your actual phone number."
            />
            <CredBox
              label="Temporary Access Token"
              example="EAAxxxxx... (very long string)"
              hint="Click 'Generate token'. For production, create a permanent System User token instead (see tip below)."
            />
          </div>
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
            💡 <strong>For production use:</strong> Go to <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className="underline">business.facebook.com</a> → Settings → Users → System Users → Create System User (Admin role) → Generate Token → select your WhatsApp app → check <code>whatsapp_business_messaging</code>. This token never expires.
          </div>
        </StepCard>
      )}

      {/* ── STEP 5 ── */}
      {activeStep === 5 && (
        <StepCard n={5} title="Paste Your Credentials Here" onBack={() => setActiveStep(4)}
          customAction={
            <button onClick={saveCredentials} disabled={saving}
              className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center gap-2 transition-colors">
              {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving...</> : saved ? '✓ Saved!' : 'Save & Continue →'}
            </button>
          }>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Phone Number ID <span className="text-red-400">*</span>
              </label>
              <input value={form.whatsappPhoneNumberId}
                onChange={e => setForm(f => ({ ...f, whatsappPhoneNumberId: e.target.value }))}
                placeholder="e.g. 123456789012345"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 font-mono" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Access Token <span className="text-red-400">*</span>
              </label>
              <textarea value={form.whatsappAccessToken}
                onChange={e => setForm(f => ({ ...f, whatsappAccessToken: e.target.value }))}
                placeholder="EAAxxxxx..."
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 font-mono resize-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                Verify Token <span className="text-red-400">*</span>
              </label>
              <input value={form.whatsappVerifyToken}
                onChange={e => setForm(f => ({ ...f, whatsappVerifyToken: e.target.value }))}
                placeholder="Make up any word e.g. mybusiness_secret_2024"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              <p className="text-xs text-gray-400 mt-1">You decide this value. You'll paste it into Meta too. Just don't share it publicly.</p>
            </div>
          </div>
        </StepCard>
      )}

      {/* ── STEP 6 ── */}
      {activeStep === 6 && (
        <StepCard n={6} title="Set Webhook in Meta Dashboard" onBack={() => setActiveStep(5)}>
          <p className="text-sm text-gray-600 mb-4">
            Go back to your Meta app → <strong>WhatsApp → Configuration → Webhook</strong> and fill in:
          </p>

          <div className="space-y-3 mb-5">
            {/* Webhook URL */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Callback URL (paste this into Meta)</p>
                <CopyBtn text={webhookUrl} id="url" label="Copy URL" />
              </div>
              <code className="text-sm text-gray-800 break-all font-mono">{webhookUrl}</code>
            </div>

            {/* Verify token */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Verify Token (paste this into Meta)</p>
                <CopyBtn text={form.whatsappVerifyToken || 'Save your credentials first'} id="token" label="Copy Token" />
              </div>
              <code className="text-sm text-gray-800 font-mono">
                {form.whatsappVerifyToken || <span className="text-gray-400 italic">Save credentials in Step 5 first</span>}
              </code>
            </div>
          </div>

          <ol className="space-y-2 text-sm text-gray-600 mb-5">
            <Li n="1">In Meta, go to <strong>WhatsApp → Configuration → Webhook</strong></Li>
            <Li n="2">Click <strong>"Edit"</strong> (or "Configure")</Li>
            <Li n="3">Paste the Callback URL above into "Callback URL"</Li>
            <Li n="4">Paste your Verify Token above into "Verify Token"</Li>
            <Li n="5">Click <strong>"Verify and Save"</strong> — Meta will call your server to confirm</Li>
            <Li n="6">After saving, click <strong>"Subscribe"</strong> next to <code>messages</code> under Webhook Fields</Li>
          </ol>

          {/* Test connection */}
          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-900 mb-3">Test your connection</p>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={testConnection} disabled={testing}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors">
                {testing ? <><RefreshCw size={14} className="animate-spin" /> Testing...</> : 'Test Connection'}
              </button>
              {status === 'connected' && (
                <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                  <CheckCircle size={16} /> Connected! Messages will flow through.
                </div>
              )}
              {status === 'failed' && (
                <div className="flex items-center gap-1.5 text-red-500 text-sm font-medium">
                  <AlertTriangle size={16} /> Failed. Check credentials and try again.
                </div>
              )}
            </div>

            {status === 'connected' && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-sm font-bold text-green-800 mb-1">🎉 You're all set!</p>
                <p className="text-xs text-green-700">
                  Send a message to your WhatsApp number and the AI will reply automatically.
                  Check the <strong>Conversations</strong> tab to see incoming messages live.
                </p>
              </div>
            )}
          </div>
        </StepCard>
      )}

      {/* Troubleshoot section */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
          <AlertTriangle size={14} /> If Meta says "Invalid" when you verify the webhook:
        </p>
        <ol className="space-y-1.5 text-xs text-amber-700">
          <Li n="1">Make sure your backend is deployed and publicly accessible (not localhost)</Li>
          <Li n="2">The Verify Token in Meta must <strong>exactly match</strong> what you typed in Step 5</Li>
          <Li n="3">Your Callback URL must start with <strong>https://</strong> (not http://)</Li>
          <Li n="4">Railway/Render must be running — check your deployment logs</Li>
          <Li n="5">Try opening your webhook URL in a browser — it should show a page (not an error)</Li>
        </ol>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const StepCard = ({ n, title, children, onNext, onBack, customAction }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 bg-gray-900 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{n}</div>
      <h2 className="font-bold text-gray-900 text-base md:text-lg">{title}</h2>
    </div>
    {children}
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
      {onBack
        ? <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">← Back</button>
        : <div />
      }
      {customAction || (onNext && (
        <button onClick={onNext}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors">
          Next <ChevronRight size={14} />
        </button>
      ))}
    </div>
  </div>
);

const Li = ({ n, children }) => (
  <li className="flex gap-3">
    <span className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0 mt-0.5">{n}</span>
    <span>{children}</span>
  </li>
);

const CredBox = ({ label, example, hint }) => (
  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
    <p className="text-xs font-semibold text-gray-700 mb-0.5">{label}</p>
    <p className="text-xs font-mono text-gray-400 mb-1">{example}</p>
    <p className="text-xs text-gray-500">{hint}</p>
  </div>
);
