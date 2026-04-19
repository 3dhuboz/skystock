import { useState, useEffect, useCallback } from 'react';
import {
  Save, Shield, Mail, CreditCard, Settings, HardDrive, Database,
  CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@clerk/clerk-react';

type ProbeStatus = 'ok' | 'missing' | 'error';
interface Probe { status: ProbeStatus; detail: string }
interface HealthResponse {
  paypal: Probe; clerk: Probe; resend: Probe; r2: Probe; d1: Probe;
  checked_at: number;
}

export default function AdminSettings() {
  const { getToken } = useAuth();
  const [form, setForm] = useState({
    default_price: '29.99',
    watermark_text: 'SKYSTOCK FPV',
    max_downloads: '5',
    link_expiry_hours: '72',
  });
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const runHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/integrations/health', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as HealthResponse;
      setHealth(data);
    } catch (e: any) {
      toast.error(`Health check failed: ${e.message || 'unknown'}`);
    } finally {
      setHealthLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    runHealth();
  }, [runHealth]);

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

  const integrations = [
    { key: 'paypal',  label: 'PayPal',              icon: <CreditCard className="w-4 h-4" />, hint: 'Checkout credentials (sandbox token probe)' },
    { key: 'clerk',   label: 'Clerk Authentication', icon: <Shield className="w-4 h-4" />,     hint: 'Admin auth (API reachability check)' },
    { key: 'resend',  label: 'Resend Email',         icon: <Mail className="w-4 h-4" />,       hint: 'Download link emails (API reachability check)' },
    { key: 'r2',      label: 'Cloudflare R2',        icon: <HardDrive className="w-4 h-4" />,  hint: 'Video bucket binding' },
    { key: 'd1',      label: 'Cloudflare D1',        icon: <Database className="w-4 h-4" />,   hint: 'Database binding' },
  ] as const;

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
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-sky-400" />
              <h2 className="font-display font-semibold text-lg text-white">Integrations</h2>
            </div>
            <button
              type="button"
              onClick={runHealth}
              disabled={healthLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium text-sky-300 hover:text-white border border-sky-700/30 hover:border-sky-500/40 bg-sky-800/20 hover:bg-sky-800/40 transition-colors disabled:opacity-50"
            >
              {healthLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {healthLoading ? 'Checking…' : 'Re-check'}
            </button>
          </div>
          <div className="space-y-3">
            {integrations.map(int => {
              const probe = health?.[int.key as keyof HealthResponse] as Probe | undefined;
              const loading = healthLoading && !health;
              return (
                <div key={int.key} className="flex items-center justify-between p-4 bg-sky-800/20 rounded-xl">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-sky-700/30 flex items-center justify-center text-sky-400">{int.icon}</div>
                    <div className="min-w-0">
                      <p className="font-display font-medium text-white">{int.label}</p>
                      <p className="text-xs text-sky-500 truncate">
                        {probe?.detail || int.hint}
                      </p>
                    </div>
                  </div>
                  <StatusPill loading={loading} probe={probe} />
                </div>
              );
            })}
          </div>
          {health && (
            <p className="text-[11px] font-mono text-sky-600 mt-3 text-right">
              Checked {new Date(health.checked_at).toLocaleTimeString()}
            </p>
          )}
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

function StatusPill({ loading, probe }: { loading: boolean; probe?: Probe }) {
  if (loading || !probe) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-800/30 text-sky-400 text-xs font-display">
        <Loader2 className="w-3 h-3 animate-spin" />
        Checking
      </span>
    );
  }
  if (probe.status === 'ok') {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-display font-medium">
        <CheckCircle2 className="w-3 h-3" />
        Connected
      </span>
    );
  }
  if (probe.status === 'missing') {
    return (
      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-display font-medium">
        <AlertTriangle className="w-3 h-3" />
        Not configured
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-display font-medium">
      <XCircle className="w-3 h-3" />
      Failing
    </span>
  );
}
