import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Package, X, ImagePlus } from 'lucide-react';
import api from '../utils/api';

const defaultForm = { name: '', description: '', price: '', category: '', currency: 'NGN', imageUrl: '' };

export default function Products() {
  const [products, setProducts]   = useState([]);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(defaultForm);
  const [saving, setSaving]       = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = () => api.get('/products').then(({ data }) => setProducts(data.data));

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show local preview instantly
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);

    // Upload to backend
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/products/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm(f => ({ ...f, imageUrl: data.imageUrl }));
    } catch {
      // fallback: store base64 directly if no upload endpoint yet
      setForm(f => ({ ...f, imageUrl: imagePreview }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/products/${editing._id}`, form);
      } else {
        await api.post('/products', form);
      }
      fetchProducts();
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;
    await api.delete(`/products/${id}`);
    fetchProducts();
  };

  const startEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || '', price: p.price, category: p.category || '', currency: p.currency, imageUrl: p.imageUrl || '' });
    setImagePreview(p.imageUrl || '');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(defaultForm);
    setImagePreview('');
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-5 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Products & Services</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Manage your catalog — AI uses this to suggest products</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm(defaultForm); setImagePreview(''); }}
          className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} /> <span className="hidden sm:inline">Add Product</span><span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">{editing ? 'Edit Product' : 'New Product'}</h3>
              <button onClick={closeForm}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Image Upload */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Product Image</label>
                <div
                  onClick={() => fileRef.current.click()}
                  className="w-full h-36 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors overflow-hidden relative"
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs font-medium">Click to change</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <ImagePlus size={24} className="text-gray-300 mb-2" />
                      <p className="text-xs text-gray-400">Click to upload image</p>
                      <p className="text-xs text-gray-300 mt-0.5">PNG, JPG up to 5MB</p>
                    </>
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <p className="text-xs text-green-600 font-medium">Uploading...</p>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                {imagePreview && (
                  <button type="button" onClick={() => { setImagePreview(''); setForm(f => ({ ...f, imageUrl: '' })); }}
                    className="text-xs text-red-400 hover:text-red-600 mt-1">Remove image</button>
                )}
              </div>

              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Product name" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description" rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
              <div className="grid grid-cols-2 gap-3">
                <input required type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="Price" className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="Category" className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeForm}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving || uploading}
                  className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 transition-colors">
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(p => (
          <div key={p._id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.name} className="w-full h-40 object-cover" />
            ) : (
              <div className="w-full h-40 bg-green-50 flex items-center justify-center">
                <Package size={32} className="text-green-200" />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-semibold text-gray-900">{p.name}</h3>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  <button onClick={() => startEdit(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => deleteProduct(p._id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {p.description && <p className="text-xs text-gray-400 mb-3 line-clamp-2">{p.description}</p>}
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-green-600">₦{p.price.toLocaleString()}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${p.isAvailable ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.isAvailable ? 'Available' : 'Unavailable'}
                </span>
              </div>
              {p.category && <span className="text-xs text-gray-400 mt-1 block">{p.category}</span>}
            </div>
          </div>
        ))}
        {!products.length && (
          <div className="col-span-full text-center py-16 text-gray-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>No products yet. Add your first product above.</p>
          </div>
        )}
      </div>
    </div>
  );
}