import { useState } from 'react';
import { Save, Shield, Mail, CreditCard, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@clerk/clerk-react';

export default function AdminSettings() {
  const { getToken } = useAuth();
  const [form, setForm] = useState({
    default_price: '29.99',
    watermark_text: 'SKYSTOCK FPV',
    max_downloads: '5',
    link_expiry_hours: '72',
  });
  const [saving, setSaving] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-enter max-w-3xl">
      <h1 className="font-display font-bold text-2xl text-white mb-2">Settings</h1>
      <p className="text-sky-500 text-sm mb-8">Configure your store defaults and integrations</p>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Store Defaults */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <Settings className="w-5 h-5 text-sky-400" />
            <h2 className="font-display font-semibold text-lg text-white">Store Defaults</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-display font-medium text-sky-300 mb-2">Default Price (AUD)</label>
              <input name="default_price" type="number" step="0.01" min="0" value={form.default_price} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-display font-medium text-sky-300 mb-2">Watermark Text</label>
              <input name="watermark_text" value={form.watermark_text} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-display font-medium text-sky-300 mb-2">Max Downloads Per Purchase</label>
              <input name="max_downloads" type="number" min="1" max="20" value={form.max_downloads} onChange={handleChange} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-display font-medium text-sky-300 mb-2">Download Link Expiry (hours)</label>
              <input name="link_expiry_hours" type="number" min="1" max="720" value={form.link_expiry_hours} onChange={handleChange} className="input-field" />
            </div>
          </div>
        </div>

        {/* Integration Status */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-5">
            <Shield className="w-5 h-5 text-sky-400" />
            <h2 className="font-display font-semibold text-lg text-white">Integrations</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: 'PayPal', icon: <CreditCard className="w-4 h-4" />, status: 'Connected', hint: 'Manage credentials via Cloudflare secrets' },
              { label: 'Clerk Authentication', icon: <Shield className="w-4 h-4" />, status: 'Connected', hint: 'Admin auth powered by Clerk' },
              { label: 'Resend Email', icon: <Mail className="w-4 h-4" />, status: 'Connected', hint: 'Download link emails via Resend' },
            ].map(int => (
              <div key={int.label} className="flex items-center justify-between p-4 bg-sky-800/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-700/30 flex items-center justify-center text-sky-400">{int.icon}</div>
                  <div>
                    <p className="font-display font-medium text-white">{int.label}</p>
                    <p className="text-xs text-sky-500">{int.hint}</p>
                  </div>
                </div>
                <span className="badge-success">{int.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
