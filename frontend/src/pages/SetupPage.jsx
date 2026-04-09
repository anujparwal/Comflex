/**
 * SetupPage — First-boot wizard for the Seed Admin.
 * 
 * Only shown when the system is unconfigured (isConfigured === false).
 * Guides the admin through: Institution name/domain → Email regex → Test → Save.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { adminApi } from '../api/adminApi';

export default function SetupPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Institution
  const [institution, setInstitution] = useState({ name: '', domain: '' });

  // Step 2: Email parsing
  const [parsing, setParsing] = useState({
    pattern: '(\\d{2})bcs\\d+',
    captureGroup: 1,
    yearOffset: 0,
  });
  const [testEmail, setTestEmail] = useState('');
  const [previewResult, setPreviewResult] = useState(null);

  const handleSetupInstitution = async () => {
    setError('');
    setLoading(true);
    try {
      await adminApi.setupInstitution(institution);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save institution settings.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    setError('');
    setPreviewResult(null);
    try {
      const res = await adminApi.previewCohortConfig({
        email: testEmail,
        pattern: parsing.pattern,
        captureGroup: parsing.captureGroup,
        yearOffset: parsing.yearOffset,
      });
      setPreviewResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Preview failed.');
    }
  };

  const handleSaveParsing = async () => {
    setError('');
    setLoading(true);
    try {
      await adminApi.updateCohortConfig({
        emailParsingRules: {
          pattern: parsing.pattern,
          captureGroup: parsing.captureGroup,
          yearOffset: parsing.yearOffset,
        },
        cohortConfig: {
          seniorOffset: -1,
          juniorOffset: 1,
          seniorAutoElevate: true,
        },
      });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to save parsing rules.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">Admin Access Required</h2>
          <p className="text-[var(--color-text-secondary)]">Only the Seed Admin can configure the platform.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg fade-in">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Comflex Setup</h1>
          <p className="text-[var(--color-text-secondary)]">
            Step {step} of 3 — {step === 1 ? 'Institution Details' : step === 2 ? 'Email Parsing Rules' : 'Complete!'}
          </p>
          {/* Progress bar */}
          <div className="mt-4 h-1 bg-[var(--color-bg-card)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-500 ease-out rounded-full"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        <div className="glass-card p-8">
          {error && (
            <div className="alert alert-danger mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Institution Details */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-2">Institution Details</h2>
              <p className="text-[var(--color-text-secondary)] text-sm mb-4">
                Set your institution name and email domain. This can be changed later from the Admin Dashboard.
              </p>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Institution Name</label>
                <input type="text" value={institution.name}
                  onChange={(e) => setInstitution({ ...institution, name: e.target.value })}
                  placeholder="Acme University" required />
              </div>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Email Domain</label>
                <input type="text" value={institution.domain}
                  onChange={(e) => setInstitution({ ...institution, domain: e.target.value })}
                  placeholder="acme.edu" required />
              </div>

              <button onClick={handleSetupInstitution} disabled={loading || !institution.name || !institution.domain}
                className="btn btn-primary w-full">
                {loading ? <span className="spinner" /> : 'Next →'}
              </button>
            </div>
          )}

          {/* Step 2: Email Parsing */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-2">Email Parsing Rules</h2>
              <p className="text-[var(--color-text-secondary)] text-sm mb-4">
                Configure the regex pattern that extracts the graduation year from student emails.
              </p>

              <div>
                <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Regex Pattern</label>
                <input type="text" value={parsing.pattern}
                  onChange={(e) => setParsing({ ...parsing, pattern: e.target.value })}
                  placeholder="(\d{2})bcs\d+" className="font-mono text-sm" />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Use a capture group to extract the year identifier.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Capture Group</label>
                  <input type="number" value={parsing.captureGroup} min={0}
                    onChange={(e) => setParsing({ ...parsing, captureGroup: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-secondary)] mb-1">Year Offset</label>
                  <input type="number" value={parsing.yearOffset}
                    onChange={(e) => setParsing({ ...parsing, yearOffset: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              {/* Live preview */}
              <div className="border-t border-[var(--color-border)] pt-4 mt-4">
                <h4 className="text-sm font-semibold mb-2">🧪 Test Your Pattern</h4>
                <div className="flex gap-2">
                  <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="28bcs045@acme.edu" className="flex-1" />
                  <button onClick={handlePreview} disabled={!testEmail} className="btn btn-secondary text-sm">
                    Test
                  </button>
                </div>

                {previewResult && (
                  <div className={`mt-3 p-3 rounded-xl text-sm ${
                    previewResult.matched
                      ? 'alert-success'
                      : 'alert-warning'
                  }`}>
                    {previewResult.matched ? (
                      <>
                        <p className="font-semibold">✅ Match! Extracted year: {previewResult.extractedYear}</p>
                        <p className="mt-1">Tags: {previewResult.predictedTags.join(', ')}</p>
                      </>
                    ) : (
                      <p>❌ No match — email didn&apos;t match the pattern.</p>
                    )}
                  </div>
                )}
              </div>

              <button onClick={handleSaveParsing} disabled={loading} className="btn btn-primary w-full">
                {loading ? <span className="spinner" /> : 'Save & Finish →'}
              </button>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="text-center space-y-4">
              <div className="text-6xl">🎉</div>
              <h2 className="text-xl font-bold">Setup Complete!</h2>
              <p className="text-[var(--color-text-secondary)]">
                The platform is now configured. Students can register using their institutional email.
              </p>
              <button onClick={() => navigate('/admin')} className="btn btn-primary">
                Go to Admin Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
