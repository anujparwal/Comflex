/**
 * ProfilePage — User's own profile with avatar, bio, tags, and badges.
 * 
 * States: Loading skeleton → Profile view → Edit mode → Save → Confirm.
 */

import { useState, useRef, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { userApi } from '../api/userApi';
import { parseIIITLEmail } from '../utils/parseEmail';
import Layout from '../components/Layout';

const RING_LABELS = ['Admin', 'Manager', 'Elevated Member', 'Member'];

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const fileInputRef = useRef(null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: '', bio: '', cfHandle: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState('');

  // Parse academic info from email
  const academicInfo = useMemo(() => parseIIITLEmail(user?.email), [user?.email]);

  // Initialize form when entering edit mode
  const startEdit = () => {
    setForm({
      displayName: user?.displayName || '',
      bio: user?.bio || '',
      cfHandle: user?.cfHandle || '',
    });
    setEditing(true);
    setMessage('');
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await userApi.updateProfile(form);
      await refreshProfile();
      setEditing(false);
      setMessage('Profile updated successfully!');
    } catch (err) {
      setMessage(err.response?.data?.error?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Client-side validation
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setMessage('Only JPEG, PNG, and WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('File must be under 5MB.');
      return;
    }

    setUploadingAvatar(true);
    setMessage('');
    try {
      await userApi.uploadAvatar(file);
      await refreshProfile();
      setMessage('Avatar updated!');
    } catch {
      setMessage('Failed to upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="space-y-4">
          <div className="skeleton h-32 w-32 rounded-full mx-auto" />
          <div className="skeleton h-6 w-48 mx-auto" />
          <div className="skeleton h-4 w-64 mx-auto" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto fade-in">
        <h1 className="text-2xl font-bold mb-8">My Profile</h1>

        {message && (
          <div className={`alert mb-6 ${
            message.includes('success') || message.includes('updated')
              ? 'alert-success'
              : 'alert-danger'
          }`}>
            {message}
          </div>
        )}

        {/* Avatar Section */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-[var(--color-border)]" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white text-3xl font-bold">
                  {user.displayName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center text-white text-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingAvatar ? <span className="spinner" /> : '📷 Change'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarUpload} className="hidden" />
            </div>

            <div>
              <h2 className="text-xl font-bold">{user.displayName}</h2>
              <p className="text-[var(--color-text-secondary)] text-sm">{user.email}</p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs text-white ring-badge-${Math.min(user.globalRing, 3)}`}>
                Ring {user.globalRing} · {RING_LABELS[user.globalRing] || 'Restricted'}
              </span>
            </div>
          </div>
        </div>

        {/* Academic Info — only shown for IIITL emails */}
        {academicInfo && (
          <div className="glass-card p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Academic Info</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-[var(--color-text-muted)]">Branch</span>
                <p className="text-[var(--color-text-secondary)] font-medium">{academicInfo.branch}</p>
              </div>
              <div>
                <span className="text-sm text-[var(--color-text-muted)]">Year of Admission</span>
                <p className="text-[var(--color-text-secondary)] font-medium">{academicInfo.yearOfAdmission}</p>
              </div>
              <div>
                <span className="text-sm text-[var(--color-text-muted)]">Roll Number</span>
                <p className="text-[var(--color-text-secondary)] font-medium">{academicInfo.rollNumber}</p>
              </div>
            </div>
          </div>
        )}

        {/* Profile Details */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Details</h3>
            {!editing && (
              <button onClick={startEdit} className="btn btn-secondary text-xs">
                ✏️ Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Display Name</label>
                <input type="text" value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  maxLength={50} />
              </div>
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Bio</label>
                <textarea value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  maxLength={500} rows={3}
                  className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] p-3 w-full resize-none focus:outline-none focus:border-[var(--color-accent)]" />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{form.bio.length}/500</p>
              </div>
              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Codeforces Handle</label>
                <input type="text" value={form.cfHandle}
                  onChange={(e) => setForm({ ...form, cfHandle: e.target.value })}
                  placeholder="your_cf_handle" />
              </div>
              <div className="flex gap-3">
                <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                  {saving ? <span className="spinner" /> : 'Save Changes'}
                </button>
                <button onClick={() => setEditing(false)} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="text-sm text-[var(--color-text-muted)]">Bio</span>
                <p className="text-[var(--color-text-secondary)]">{user.bio || 'No bio set.'}</p>
              </div>
              <div>
                <span className="text-sm text-[var(--color-text-muted)]">Codeforces</span>
                <p className="text-[var(--color-text-secondary)]">{user.cfHandle || 'Not linked'}</p>
              </div>
              <div>
                <span className="text-sm text-[var(--color-text-muted)]">Credits</span>
                <p className="text-[var(--color-text-secondary)]">{user.creditBalance ?? 0}</p>
              </div>
              <div>
                <span className="text-sm text-[var(--color-text-muted)]">Joined</span>
                <p className="text-[var(--color-text-secondary)]">{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Cohort Tags */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Cohort Groups</h3>
          {user.cohortTags?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {user.cohortTags.map((tag) => (
                <span key={tag} className="px-3 py-1.5 chip-accent rounded-full text-sm">
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[var(--color-text-muted)] text-sm">No cohort tags assigned.</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
