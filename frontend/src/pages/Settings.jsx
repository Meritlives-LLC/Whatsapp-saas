import { useState, useEffect } from 'react';
import { Save, Bot, MessageSquare, Zap, Webhook } from 'lucide-react';
import api from '../utils/api';

export default function Settings() {
  const [business, setBusiness] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('general');

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

  if (!business) return <div className="p-8 text-gray-400">Loading...</div>;

  const tabs = [
    { id: 'general', label: 'General', icon: Zap },
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'ai', label: 'AI Knowledge', icon: Bot },
    { id: 'automation', label: 'Automation', icon: Webhook },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your business and AI behavior</p>
        </div>
        <button onClick={save} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            saved ? 'bg-green-500 text-white' : 'bg-gray-900 hover:bg-gray-700 text-white'
          } disabled:opacity-60`}>
          <Save size={15} />
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Tabs */}
        <div className="w-48 flex flex-col gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === id ? 'bg-green-50 text-green-700' : 'text-gray-500 hover:bg-gray-50'
              }`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          {/* GENERAL */}
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
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone"><input value={business.phone || ''} onChange={e => update('phone', e.target.value)} className={inputCls} /></Field>
                <Field label="Email"><input value={business.email || ''} onChange={e => update('email', e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="Industry"><input value={business.industry || ''} onChange={e => update('industry', e.target.value)} className={inputCls} /></Field>
            </div>
          )}

          {/* WHATSAPP */}
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
                <code className="text-xs bg-white border border-gray-200 px-2 py-1 rounded">
                  {window.location.origin}/api/webhook
                </code>
              </div>
            </div>
          )}

          {/* AI KNOWLEDGE */}
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

          {/* AUTOMATION */}
          {tab === 'automation' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-gray-900 mb-4">Automation Settings</h3>
              {[
                { key: 'settings.autoReply', label: 'Auto AI Reply', desc: 'AI automatically replies to incoming messages' },
                { key: 'settings.autoFollowUp', label: 'Auto Follow-up', desc: 'Send follow-up messages to inactive conversations' },
                { key: 'settings.leadCapture', label: 'Lead Capture', desc: 'Automatically detect and tag leads from conversations' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
                  <div>
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
    className={`w-11 h-6 rounded-full transition-colors relative ${checked ? 'bg-green-500' : 'bg-gray-200'}`}>
    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${checked ? 'left-5.5' : 'left-0.5'}`}
      style={{ left: checked ? '1.375rem' : '0.125rem' }} />
  </button>
);
