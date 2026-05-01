import { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle,
         CreditCard, Building2, Smartphone, Search, Loader2,
         Copy, ExternalLink, ChevronDown, Trash2, Star } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import api from '../utils/api';

// ════════════════════════════════════════════════════════════════════════════════
// BOOKINGS
// ════════════════════════════════════════════════════════════════════════════════
export function Bookings() {
  const [appointments, setAppointments] = useState([]);

  useEffect(() => { api.get('/appointments').then(({ data }) => setAppointments(data.data)); }, []);

  const statusConfig = {
    pending:   { icon: AlertCircle, color: 'text-amber-600 bg-amber-50',  label: 'Pending' },
    confirmed: { icon: CheckCircle, color: 'text-green-600 bg-green-50',  label: 'Confirmed' },
    cancelled: { icon: XCircle,     color: 'text-red-500 bg-red-50',      label: 'Cancelled' },
    completed: { icon: CheckCircle, color: 'text-blue-600 bg-blue-50',    label: 'Completed' },
  };

  const updateStatus = (id, status) => {
    api.patch(`/appointments/${id}`, { status }).then(() =>
      setAppointments(prev => prev.map(a => a._id === id ? { ...a, status } : a))
    );
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage customer appointments</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Customer','Service','Date & Time','Status','Action'].map(h => (
                <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {appointments.map(appt => {
              const sc = statusConfig[appt.status] || statusConfig.pending;
              const Icon = sc.icon;
              return (
                <tr key={appt._id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600">
                        {(appt.customerName||'?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{appt.customerName||'Unknown'}</p>
                        <p className="text-xs text-gray-400">{appt.customerPhone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{appt.service||'—'}</td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900">{format(new Date(appt.scheduledAt),'MMM d, yyyy')}</p>
                    <p className="text-xs text-gray-400">{format(new Date(appt.scheduledAt),'h:mm a')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${sc.color}`}>
                      <Icon size={12}/> {sc.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select value={appt.status} onChange={e=>updateStatus(appt._id,e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-400">
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirm</option>
                      <option value="cancelled">Cancel</option>
                      <option value="completed">Complete</option>
                    </select>
                  </td>
                </tr>
              );
            })}
            {!appointments.length && (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400 text-sm">No bookings yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// BANK ACCOUNT MANAGER
// ════════════════════════════════════════════════════════════════════════════════
function BankAccountManager({ onSelect }) {
  const [accounts, setAccounts] = useState([]);
  const [banks, setBanks]       = useState([]);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState({ accountNumber:'', bankCode:'', bankName:'' });
  const [resolved, setResolved] = useState(null); // { account_name }
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  useEffect(() => {
    api.get('/payments/bank-accounts').then(({data}) => setAccounts(data.data));
    api.get('/payments/banks').then(({data}) => setBanks(data.data));
  }, []);

  const filteredBanks = banks.filter(b =>
    b.name.toLowerCase().includes(bankSearch.toLowerCase())
  );

  const verifyAccount = async () => {
    if (!form.accountNumber || !form.bankCode) return;
    setVerifying(true); setResolved(null);
    try {
      const { data } = await api.get(`/payments/verify-account?accountNumber=${form.accountNumber}&bankCode=${form.bankCode}`);
      setResolved(data.data);
    } catch {
      setResolved({ error: true });
    } finally {
      setVerifying(false);
    }
  };

  const saveAccount = async () => {
    if (!resolved?.account_name) return;
    setSaving(true);
    try {
      await api.post('/payments/bank-accounts', {
        accountName: resolved.account_name,
        accountNumber: form.accountNumber,
        bankCode: form.bankCode,
        bankName: form.bankName,
        isDefault: accounts.length === 0,
      });
      const { data } = await api.get('/payments/bank-accounts');
      setAccounts(data.data);
      setShowAdd(false);
      setForm({ accountNumber:'', bankCode:'', bankName:'' });
      setResolved(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (id) => {
    await api.delete(`/payments/bank-accounts/${id}`);
    setAccounts(prev => prev.filter(a => a._id !== id));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Your Payout Accounts</h3>
          <p className="text-xs text-gray-400 mt-0.5">Bank accounts you can generate transfer payment links for</p>
        </div>
        <button onClick={()=>setShowAdd(s=>!s)}
          className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-semibold transition-colors">
          + Add Bank
        </button>
      </div>

      {/* Saved accounts */}
      <div className="space-y-2 mb-4">
        {accounts.map(acc => (
          <div key={acc._id} className={`flex items-center justify-between p-3 rounded-xl border ${acc.isDefault ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white border border-gray-200 rounded-lg flex items-center justify-center">
                <Building2 size={14} className="text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{acc.accountName}</p>
                <p className="text-xs text-gray-500">{acc.bankName} • {acc.accountNumber}</p>
              </div>
              {acc.isDefault && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Star size={9}/>Default</span>}
            </div>
            <div className="flex items-center gap-2">
              {onSelect && (
                <button onClick={()=>onSelect(acc)}
                  className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors">
                  Use
                </button>
              )}
              <button onClick={()=>deleteAccount(acc._id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 size={13}/>
              </button>
            </div>
          </div>
        ))}
        {!accounts.length && !showAdd && (
          <p className="text-sm text-gray-400 text-center py-4">No bank accounts saved yet</p>
        )}
      </div>

      {/* Add account form */}
      {showAdd && (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Add New Bank Account</p>

          {/* Bank selector */}
          <div className="relative">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input value={bankSearch} onChange={e=>setBankSearch(e.target.value)}
                placeholder="Search bank name..."
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-400"/>
            </div>
            {bankSearch && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                {filteredBanks.slice(0,10).map(b => (
                  <button key={b.code} onClick={()=>{
                    setForm(f=>({...f,bankCode:b.code,bankName:b.name}));
                    setBankSearch(b.name);
                    setResolved(null);
                  }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-none">
                    {b.name}
                  </button>
                ))}
                {!filteredBanks.length && <p className="px-3 py-2 text-sm text-gray-400">No banks found</p>}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input value={form.accountNumber} onChange={e=>{setForm(f=>({...f,accountNumber:e.target.value}));setResolved(null);}}
              placeholder="Account number (10 digits)"
              maxLength={10}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-green-400"/>
            <button onClick={verifyAccount} disabled={verifying || !form.accountNumber || !form.bankCode || form.accountNumber.length < 10}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors flex items-center gap-1">
              {verifying ? <><Loader2 size={11} className="animate-spin"/> Verifying</> : 'Verify'}
            </button>
          </div>

          {resolved && (
            <div className={`p-3 rounded-lg text-sm ${resolved.error ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {resolved.error ? '❌ Could not verify. Check account number and bank.' : `✅ ${resolved.account_name}`}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={()=>{setShowAdd(false);setResolved(null);setBankSearch('');setForm({accountNumber:'',bankCode:'',bankName:''}); }}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-100">Cancel</button>
            <button onClick={saveAccount} disabled={saving || !resolved?.account_name}
              className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Save Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ════════════════════════════════════════════════════════════════════════════════
const METHOD_ICONS = {
  card:          { icon: CreditCard,  label: 'Card',          color: 'text-blue-600 bg-blue-50'   },
  bank_transfer: { icon: Building2,   label: 'Bank Transfer', color: 'text-green-600 bg-green-50' },
  ussd:          { icon: Smartphone,  label: 'USSD',          color: 'text-purple-600 bg-purple-50'},
  mobile_money:  { icon: Smartphone,  label: 'Mobile Money',  color: 'text-amber-600 bg-amber-50' },
};

export function Payments() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal]     = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab]           = useState('all');  // 'all' | 'card' | 'bank_transfer'
  const [form, setForm]         = useState({
    customerEmail: '', amount: '', customerName: '',
    paymentMethod: 'all', productId: '',
  });
  const [result, setResult]   = useState(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied]   = useState(false);

  useEffect(() => { fetchTx(); }, [tab]);

  const fetchTx = async () => {
    const params = tab !== 'all' ? `?paymentMethod=${tab}` : '';
    const { data } = await api.get(`/payments/transactions${params}`);
    setTransactions(data.data);
    setTotal(data.total);
  };

  const createLink = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        customerEmail: form.customerEmail,
        amount: Number(form.amount),
        customerName: form.customerName,
        paymentMethod: form.paymentMethod === 'all' ? undefined : form.paymentMethod,
      };
      const { data } = await api.post('/payments/create-link', payload);
      setResult(data.data.paymentLink);
    } finally {
      setCreating(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusBadge = (s) => ({
    pending:   'bg-amber-50 text-amber-700',
    success:   'bg-green-50 text-green-700',
    failed:    'bg-red-50 text-red-600',
    abandoned: 'bg-gray-100 text-gray-500',
  }[s] || 'bg-gray-100 text-gray-500');

  const totalRevenue = transactions.filter(t=>t.status==='success').reduce((s,t)=>s+t.amount,0);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500 mt-1">Transactions via card, bank transfer & USSD</p>
        </div>
        <button onClick={()=>{setShowForm(true);setResult(null);}}
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors">
          + Generate Payment Link
        </button>
      </div>

      {/* Bank account manager */}
      <BankAccountManager />

      {/* Payment link modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Generate Payment Link</h3>
              <button onClick={()=>{setShowForm(false);setResult(null);}} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {result ? (
              <div>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={24} className="text-green-600"/>
                </div>
                <p className="text-center text-sm font-semibold text-gray-900 mb-4">Payment link ready!</p>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 break-all text-xs text-gray-700 font-mono">{result}</div>
                <div className="flex gap-2">
                  <button onClick={copyLink}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}>
                    <Copy size={13}/> {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                  <a href={result} target="_blank" rel="noreferrer"
                    className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 flex items-center gap-1.5 hover:bg-gray-50 transition-colors">
                    <ExternalLink size={13}/> Open
                  </a>
                </div>
                <button onClick={()=>{setResult(null);setForm({customerEmail:'',amount:'',customerName:'',paymentMethod:'all'});}}
                  className="w-full mt-2 py-2 text-sm text-gray-400 hover:text-gray-600">Create another</button>
              </div>
            ) : (
              <form onSubmit={createLink} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Customer Name</label>
                  <input required value={form.customerName} onChange={e=>setForm(f=>({...f,customerName:e.target.value}))}
                    placeholder="e.g. Amaka Eze"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Customer Email</label>
                  <input required type="email" value={form.customerEmail} onChange={e=>setForm(f=>({...f,customerEmail:e.target.value}))}
                    placeholder="customer@email.com"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">Amount (₦)</label>
                  <input required type="number" min="100" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))}
                    placeholder="e.g. 5000"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400"/>
                </div>

                {/* Payment method selector */}
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value:'all',           icon: CreditCard,  label:'All methods' },
                      { value:'card',          icon: CreditCard,  label:'Card only'   },
                      { value:'bank_transfer', icon: Building2,   label:'Bank transfer only' },
                    ].map(({value, icon: Icon, label}) => (
                      <button key={value} type="button"
                        onClick={()=>setForm(f=>({...f,paymentMethod:value}))}
                        className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                          form.paymentMethod === value
                            ? 'border-green-400 bg-green-50 text-green-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        <Icon size={16}/>
                        {label}
                      </button>
                    ))}
                  </div>
                  {form.paymentMethod === 'bank_transfer' && (
                    <p className="text-xs text-blue-600 mt-2 bg-blue-50 p-2 rounded-lg">
                      Customer gets a virtual account to transfer into. Money reflects automatically.
                    </p>
                  )}
                  {form.paymentMethod === 'all' && (
                    <p className="text-xs text-gray-400 mt-2">
                      Customer can pay with card, bank transfer, USSD, or mobile money.
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={()=>setShowForm(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={creating}
                    className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors">
                    {creating ? 'Creating...' : 'Generate Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Revenue summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label:'Total Revenue', value:`₦${totalRevenue.toLocaleString()}`, color:'bg-green-500' },
          { label:'Transactions', value: transactions.filter(t=>t.status==='success').length, color:'bg-blue-500' },
          { label:'Pending', value: transactions.filter(t=>t.status==='pending').length, color:'bg-amber-500' },
          { label:'Failed', value: transactions.filter(t=>t.status==='failed').length, color:'bg-red-500' },
        ].map(({label,value,color}) => (
          <div key={label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-2 h-7 rounded-full ${color} mb-2`}/>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[
          {value:'all', label:'All payments'},
          {value:'card', label:'Card'},
          {value:'bank_transfer', label:'Bank Transfer'},
          {value:'ussd', label:'USSD'},
        ].map(({value,label}) => (
          <button key={value} onClick={()=>setTab(value)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab===value ? 'bg-green-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-green-300'
            }`}>{label}</button>
        ))}
      </div>

      {/* Transactions table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Customer','Amount','Method','Reference','Status','Date'].map(h => (
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => {
              const method = METHOD_ICONS[t.paymentMethod] || METHOD_ICONS.card;
              const MethodIcon = method.icon;
              return (
                <tr key={t._id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-gray-900">{t.customerName||'—'}</p>
                    <p className="text-xs text-gray-400">{t.customerEmail}</p>
                  </td>
                  <td className="px-5 py-3 text-sm font-bold text-gray-900">₦{t.amount.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${method.color}`}>
                      <MethodIcon size={10}/> {method.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400 font-mono">{t.reference}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(t.status)}`}>{t.status}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">{format(new Date(t.createdAt),'MMM d, yyyy')}</td>
                </tr>
              );
            })}
            {!transactions.length && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No transactions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
