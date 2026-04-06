/**
 * AdminDashboard — Institution config, cohort rules, user management.
 * 
 * Only accessible to Ring 0 (Admin) users.
 * Three tabs: Institution Config | Cohort Rules | User Management.
 */

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../api/adminApi';
import Layout from '../components/Layout';

const RING_LABELS = ['Admin', 'Manager', 'Elevated', 'Member', 'Restricted'];

export default function AdminDashboard() {
  const [tab, setTab] = useState('institution');

  return (
    <Layout>
      <div className="max-w-4xl mx-auto fade-in">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-[var(--color-bg-card)] rounded-xl p-1 mb-8">
          {[
            { key: 'institution', label: '🏛 Institution' },
            { key: 'cohort', label: '🏷 Cohort Rules' },
            { key: 'users', label: '👥 Users' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-[var(--color-accent)] text-white shadow-lg'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'institution' && <InstitutionTab />}
        {tab === 'cohort' && <CohortTab />}
        {tab === 'users' && <UsersTab />}
      </div>
    </Layout>
  );
}

// ============================================================
// Institution Tab
// ============================================================
function InstitutionTab() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', domain: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    adminApi.getInstitution().then((res) => {
      const data = res.data.data;
      setConfig(data);
      setForm({ name: data?.name || '', domain: data?.domain || '' });
    }).catch(() => setMessage('Failed to load config.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await adminApi.updateInstitution(form);
      setMessage('Institution settings updated!');
    } catch (err) {
      setMessage(err.response?.data?.error?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="space-y-3"><div className="skeleton h-12 w-full" /><div className="skeleton h-12 w-full" /></div>;

  return (
    <div className="glass-card p-6 space-y-4">
      <h3 className="text-lg font-semibold">Institution Settings</h3>
      {message && <div className="text-sm text-[var(--color-success)]">{message}</div>}
      <div>
        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Institution Name</label>
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Email Domain</label>
        <input type="text" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--color-text-muted)]">Status:</span>
        <span className={`px-2 py-0.5 rounded-full text-xs text-white ${config?.isConfigured ? 'bg-[var(--color-success)]' : 'bg-[var(--color-warning)]'}`}>
          {config?.isConfigured ? 'Configured' : 'Not Configured'}
        </span>
      </div>
      <button onClick={handleSave} disabled={saving} className="btn btn-primary">
        {saving ? <span className="spinner" /> : 'Save Changes'}
      </button>
    </div>
  );
}

// ============================================================
// Cohort Rules Tab
// ============================================================
function CohortTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ pattern: '', captureGroup: 1, yearOffset: 0 });
  const [testEmail, setTestEmail] = useState('');
  const [preview, setPreview] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    adminApi.getCohortConfig().then((res) => {
      const rules = res.data.data?.emailParsingRules;
      if (rules) {
        setForm({
          pattern: rules.pattern || '',
          captureGroup: rules.captureGroup ?? 1,
          yearOffset: rules.yearOffset ?? 0,
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const handlePreview = async () => {
    setPreview(null);
    try {
      const res = await adminApi.previewCohortConfig({ email: testEmail, ...form });
      setPreview(res.data.data);
    } catch {
      setPreview({ matched: false });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await adminApi.updateCohortConfig({
        emailParsingRules: form,
        cohortConfig: { seniorOffset: -1, juniorOffset: 1, seniorAutoElevate: true },
      });
      setMessage('Cohort rules saved!');
    } catch (err) {
      setMessage(err.response?.data?.error?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="skeleton h-48 w-full" />;

  return (
    <div className="glass-card p-6 space-y-4">
      <h3 className="text-lg font-semibold">Email Parsing Rules</h3>
      {message && <div className="text-sm text-[var(--color-success)]">{message}</div>}

      <div>
        <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Regex Pattern</label>
        <input type="text" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })}
          className="font-mono text-sm" placeholder="(\d{2})bcs\d+" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Capture Group</label>
          <input type="number" value={form.captureGroup} min={0}
            onChange={(e) => setForm({ ...form, captureGroup: parseInt(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Year Offset</label>
          <input type="number" value={form.yearOffset}
            onChange={(e) => setForm({ ...form, yearOffset: parseInt(e.target.value) || 0 })} />
        </div>
      </div>

      {/* Test */}
      <div className="border-t border-[var(--color-border)] pt-4">
        <h4 className="text-sm font-semibold mb-2">🧪 Live Test</h4>
        <div className="flex gap-2">
          <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)}
            placeholder="28bcs045@acme.edu" className="flex-1" />
          <button onClick={handlePreview} disabled={!testEmail} className="btn btn-secondary text-sm">Test</button>
        </div>
        {preview && (
          <div className={`mt-3 p-3 rounded-xl text-sm ${preview.matched ? 'bg-[var(--color-success)] bg-opacity-10 text-[var(--color-success)]' : 'bg-[var(--color-warning)] bg-opacity-10 text-[var(--color-warning)]'}`}>
            {preview.matched
              ? <>✅ Year: {preview.extractedYear} | Tags: {preview.predictedTags?.join(', ')}</>
              : '❌ No match'}
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={saving} className="btn btn-primary">
        {saving ? <span className="spinner" /> : 'Save Rules'}
      </button>
    </div>
  );
}

// ============================================================
// Users Tab
// ============================================================
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({ search, page, limit: 10 });
      setUsers(res.data.data.users);
      setPagination(res.data.data.pagination);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRingChange = async (userId, newRing) => {
    try {
      await adminApi.setUserRing(userId, newRing);
      fetchUsers(pagination.page);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to change ring.');
    }
  };

  const handleRetag = async (userId) => {
    try {
      await adminApi.retagUser(userId);
      fetchUsers(pagination.page);
    } catch {
      alert('Retag failed.');
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">User Management</h3>
        <span className="text-sm text-[var(--color-text-muted)]">{pagination.total || 0} users</span>
      </div>

      {/* Search */}
      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email..." className="mb-4" />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 w-full" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-4 p-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
              {/* Avatar */}
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white font-bold text-sm">
                  {u.displayName?.charAt(0)?.toUpperCase()}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{u.displayName}</p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">{u.email}</p>
              </div>

              {/* Tags */}
              <div className="hidden md:flex gap-1">
                {u.cohortTags?.slice(0, 2).map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-[var(--color-accent)] bg-opacity-10 text-[var(--color-accent-light)] rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Ring selector */}
              <select
                value={u.globalRing}
                onChange={(e) => handleRingChange(u.id, parseInt(e.target.value))}
                className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-sm px-2 py-1 text-[var(--color-text-primary)]"
              >
                {[0, 1, 2, 3, 4].map((r) => (
                  <option key={r} value={r}>Ring {r} - {RING_LABELS[r] || 'Restricted'}</option>
                ))}
              </select>

              {/* Retag button */}
              <button onClick={() => handleRetag(u.id)} className="btn btn-secondary text-xs px-2 py-1"
                title="Re-process cohort tags">
                🔄
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => fetchUsers(i + 1)}
              className={`w-8 h-8 rounded-lg text-sm ${
                pagination.page === i + 1
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
