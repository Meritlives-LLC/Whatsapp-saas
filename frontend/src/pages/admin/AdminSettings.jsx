import { useState } from 'react';
import { Shield, UserPlus, Check, Eye, EyeOff } from 'lucide-react';
import api from '../../utils/api';

export default function AdminSettings() {
  const [form, setForm]     = useState({ name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);
  const [showPass, setShowPass] = useState(false);

  const createAdmin = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const { data } = await api.post('/admin/create-admin', form);
      setMsg({ type: 'success', text: `Admin account created for ${data.data.name}` });
      setForm({ name: '', email: '', password: '' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to create admin' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Platform configuration and admin management</p>
      </div>

      <div className="max-w-lg">
        {/* Create admin */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-red-900 rounded-xl flex items-center justify-center">
              <UserPlus size={16} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Create Admin Account</h3>
              <p className="text-xs text-gray-500">Admins have full platform access</p>
            </div>
          </div>

          {msg && (
            <div className={`mb-4 p-3 rounded-lg text-xs font-medium ${
              msg.type === 'success' ? 'bg-green-900/50 border border-green-700 text-green-300' :
              'bg-red-900/50 border border-red-700 text-red-300'
            }`}>
              {msg.text}
            </div>
          )}

          <form onSubmit={createAdmin} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Full Name</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Admin name"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 text-white text-sm rounded-xl focus:outline-none focus:border-gray-500 placeholder-gray-600" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Email</label>
              <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="admin@yourplatform.com"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 text-white text-sm rounded-xl focus:outline-none focus:border-gray-500 placeholder-gray-600" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Password</label>
              <div className="relative">
                <input required type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Strong password"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 text-white text-sm rounded-xl focus:outline-none focus:border-gray-500 placeholder-gray-600 pr-10" />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              <Shield size={14} />
              {saving ? 'Creating...' : 'Create Admin Account'}
            </button>
          </form>
        </div>

        {/* Info box */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Admin Permissions</h3>
          <ul className="space-y-2">
            {[
              'View all businesses and their data',
              'Override subscription plans manually',
              'Add AI reply credits to any account',
              'Suspend or reactivate business accounts',
              'Permanently delete accounts and data',
              'View platform-wide revenue and analytics',
              'Create additional admin accounts',
            ].map(perm => (
              <li key={perm} className="flex items-center gap-2 text-xs text-gray-400">
                <Check size={12} className="text-green-500 flex-shrink-0" />
                {perm}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
