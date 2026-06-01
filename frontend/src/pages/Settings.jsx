import { useState, useEffect } from 'react';
import { Save, Bot, MessageSquare, Zap, Webhook, Banknote, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import api from '../utils/api';
import logo from '../assets/logo.svg';

const defaultForm = { name: '', description: '', price: '', category: '', currency: 'NGN' };

export default function Settings() {
  const [business, setBusiness] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [tab, setTab]           = useState('general');

  // Security tab state
  const [pwForm, setPwForm]         = useState({ current: '', newPw: '', confirm: '' });
  const [showPw, setShowPw]         = useState({ current: false, newPw: false, confirm: false });
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwMsg, setPwMsg]           = useState(null);

  useEffect(() => { api.get('/business').then(({ data }) => setBusiness(data.data)); }, []);

  const update = (path, value) => {
    setBusiness(prev => {
      const keys = path.split('.');
      const updated = { ...prev };
      let obj = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  const LogoIcon = () => (
    <img src={logo} alt="logo" className="w-4 h-4 object-contain rounded-sm" />
  );

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/business', business);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'Please fill in all password fields.' }); return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'New passwords do not match.' }); return;
    }
    if (pwForm.newPw.length < 6) {
      setPwMsg({ type: 'error', text: 'New password must be at least 6 characters.' }); return;
    }
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.newPw });
      setPwMsg({ type: 'success', text: 'Password changed successfully!' });
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.message || 'Failed to change password.' });
    } finally {
      setPwSaving(false);
    }
  };

  if (!business) return <div className="p-8 text-gray-400">Loading...</div>;

  const tabs = [
    { id: 'general',    label: 'General',    icon: LogoIcon },
    { id: 'whatsapp',   label: 'WhatsApp',   icon: MessageSquare },
    { id: 'payment',    label: 'Payment',    icon: Banknote },
    { id: 'ai',         label: 'AI Knowledge', icon: Bot },
    { id: 'automation', label: 'Automation', icon: Webhook },
    { id: 'security',   label: 'Security',   icon: ShieldCheck },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-5 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Configure your business and AI behavior</p>
        </div>
        <button onClick={save} disabled={saving}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            saved ? 'bg-green-500 text-white' : 'bg-gray-900 hover:bg-gray-700 text-white'
          } disabled:opacity-60`}>
          <Save size={15} />
          <span className="hidden sm:inline">{saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}</span>
          <span className="sm:hidden">{saved ? '✓' : 'Save'}</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">

        {/* Mobile tabs */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                tab === id ? 'bg-green-50 text-green-700' : 'text-gray-500 bg-gray-100'
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Desktop tabs */}
        <div className="hidden md:flex w-48 flex-col gap-1 flex-shrink-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === id ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-4 md:p-6">

          {tab === 'general' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 mb-4">Business Information</h3>
              <Field label="Business Name">
                <input value={business.name || ''} onChange={e => update('name', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Description">
                <textarea value={business.description || ''} onChange={e => update('description', e.target.value)}
                  rows={3} className={`${inputCls} resize-none`} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Phone"><input value={business.phone || ''} onChange={e => update('phone', e.target.value)} className={inputCls} /></Field>
                <Field label="Email"><input value={business.email || ''} onChange={e => update('email', e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="Industry">
                <input value={business.industry || ''} onChange={e => update('industry', e.target.value)} className={inputCls} />
              </Field>
            </div>
          )}

          {tab === 'whatsapp' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 mb-2">WhatsApp Cloud API</h3>
              <p className="text-xs text-gray-400 bg-blue-50 p-3 rounded-lg mb-4">
                Get these values from your <strong>Meta for Developers</strong> dashboard → WhatsApp → API Setup.
              </p>
              <Field label="Phone Number ID">
                <input value={business.whatsappPhoneNumberId || ''} onChange={e => update('whatsappPhoneNumberId', e.target.value)} className={inputCls} placeholder="e.g. 123456789" />
              </Field>
              <Field label="Access Token">
                <input value={business.whatsappAccessToken || ''} onChange={e => update('whatsappAccessToken', e.target.value)} className={inputCls} placeholder="EAAxxxxx..." />
              </Field>
              <Field label="Verify Token">
                <input value={business.whatsappVerifyToken || ''} onChange={e => update('whatsappVerifyToken', e.target.value)} className={inputCls} placeholder="Your custom verify token" />
              </Field>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
                <p className="font-semibold mb-1">Webhook URL to set in Meta:</p>
                <code className="text-xs bg-white border border-gray-200 px-2 py-1 rounded break-all">
                  {(import.meta.env.VITE_API_URL || window.location.origin)}/api/webhook
                </code>
              </div>
            </div>
          )}

          {tab === 'payment' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 mb-2">Payment Details</h3>
              <p className="text-xs text-gray-400 bg-green-50 p-3 rounded-lg mb-4">
                When customers ask how to pay, the AI will automatically share these bank details with them.
              </p>
              <Field label="Bank Name">
                <input value={business.paymentDetails?.bankName || ''} onChange={e => update('paymentDetails.bankName', e.target.value)}
                  className={inputCls} placeholder="e.g. First Bank" />
              </Field>
              <Field label="Account Number">
                <input value={business.paymentDetails?.accountNumber || ''} onChange={e => update('paymentDetails.accountNumber', e.target.value)}
                  className={inputCls} placeholder="e.g. 1234567890" />
              </Field>
              <Field label="Account Name">
                <input value={business.paymentDetails?.accountName || ''} onChange={e => update('paymentDetails.accountName', e.target.value)}
                  className={inputCls} placeholder="e.g. John's Bakery" />
              </Field>
              <Field label="Payment Instructions (optional)">
                <textarea value={business.paymentDetails?.instructions || ''} onChange={e => update('paymentDetails.instructions', e.target.value)}
                  rows={3} className={`${inputCls} resize-none`}
                  placeholder="e.g. Send receipt to this number after payment for order confirmation." />
              </Field>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
                <p className="font-semibold mb-2 text-gray-700">Preview — what customers will see:</p>
                <p className="text-xs text-gray-500 whitespace-pre-line">{`To complete your payment, please transfer to:

Bank: ${business.paymentDetails?.bankName || 'First Bank'}
Account Number: ${business.paymentDetails?.accountNumber || '1234567890'}
Account Name: ${business.paymentDetails?.accountName || 'Your Business Name'}

${business.paymentDetails?.instructions || 'Send your payment receipt here after transfer and we will confirm your order. ✅'}`}
                </p>
              </div>
            </div>
          )}

          {tab === 'ai' && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900 mb-2">AI Knowledge Base</h3>
              <p className="text-xs text-gray-400 mb-4">The AI uses this info to answer customer questions accurately.</p>
              <Field label="Greeting Message">
                <textarea value={business.aiKnowledge?.greeting || ''} onChange={e => update('aiKnowledge.greeting', e.target.value)}
                  rows={2} className={`${inputCls} resize-none`} />
              </Field>
              <Field label="Working Hours">
                <input value={business.aiKnowledge?.workingHours || ''} onChange={e => update('aiKnowledge.workingHours', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Policies">
                <textarea value={business.aiKnowledge?.policies || ''} onChange={e => update('aiKnowledge.policies', e.target.value)}
                  rows={3} className={`${inputCls} resize-none`} placeholder="Return policy, delivery, etc." />
              </Field>
              <Field label="Custom AI Instructions">
                <textarea value={business.aiKnowledge?.customInstructions || ''} onChange={e => update('aiKnowledge.customInstructions', e.target.value)}
                  rows={4} className={`${inputCls} resize-none`} placeholder="Specific instructions for the AI assistant..." />
              </Field>
            </div>
          )}

          {tab === 'automation' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-gray-900 mb-4">Automation Settings</h3>
              {[
                { key: 'settings.autoReply',    label: 'Auto AI Reply',   desc: 'AI automatically replies to incoming messages' },
                { key: 'settings.autoFollowUp', label: 'Auto Follow-up',  desc: 'Send follow-up messages to inactive conversations' },
                { key: 'settings.leadCapture',  label: 'Lead Capture',    desc: 'Automatically detect and tag leads from conversations' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </div>
                  <Toggle
                    checked={key.split('.').reduce((o, k) => o?.[k], business) || false}
                    onChange={v => update(key, v)}
                  />
                </div>
              ))}
              <Field label="Follow-up delay (hours)">
                <input type="number" value={business.settings?.followUpDelayHours || 24}
                  onChange={e => update('settings.followUpDelayHours', Number(e.target.value))} className={inputCls} min={1} max={168} />
              </Field>
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-gray-900 mb-2">Change Password</h3>
              <p className="text-xs text-gray-400 bg-blue-50 p-3 rounded-lg mb-4">
                Leave unchanged if you signed up with Google — set a password here to also enable email login.
              </p>

              {pwMsg && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
                  pwMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                }`}>
                  {pwMsg.text}
                  <button onClick={() => setPwMsg(null)} className="ml-auto opacity-60 hover:opacity-100">✕</button>
                </div>
              )}

              {[
                { key: 'current', label: 'Current Password',  placeholder: 'Enter current password' },
                { key: 'newPw',   label: 'New Password',      placeholder: 'At least 6 characters' },
                { key: 'confirm', label: 'Confirm New Password', placeholder: 'Repeat new password' },
              ].map(({ key, label, placeholder }) => (
                <Field key={key} label={label}>
                  <div className="relative">
                    <input
                      type={showPw[key] ? 'text' : 'password'}
                      placeholder={placeholder}
                      value={pwForm[key]}
                      onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPw[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </Field>
              ))}

              <button
                onClick={savePassword}
                disabled={pwSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
              >
                <ShieldCheck size={15} />
                {pwSaving ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400';

const Field = ({ label, children }) => (
  <div>
    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">{label}</label>
    {children}
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <button onClick={() => onChange(!checked)}
    className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-green-500' : 'bg-gray-200'}`}>
    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all`}
      style={{ left: checked ? '1.375rem' : '0.125rem' }} />
  </button>
);