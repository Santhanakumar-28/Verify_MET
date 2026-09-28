import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Scale, 
  UserCheck, 
  AlertTriangle, 
  QrCode, 
  Search, 
  FileText, 
  Send, 
  Camera, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  MessageSquare,
  Lock,
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [activeRole, setActiveRole] = useState('admin'); // 'merchant', 'inspector', 'admin', 'public'
  const [instruments, setInstruments] = useState([]);
  const [applications, setApplications] = useState([]);
  const [riskFlags, setRiskFlags] = useState([]);
  const [inspectorsSummary, setInspectorsSummary] = useState([]);
  const [chainStatus, setChainStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Merchant Portal State
  const [newInstModal, setNewInstModal] = useState(false);
  const [instForm, setInstForm] = useState({
    owner_id: 'usr-mer-01',
    category: 'ELECTRONIC_WEIGHING',
    make: '',
    model: '',
    serial_number: '',
    capacity: '30 kg (e=5g)',
    accuracy_class: 'Class III',
    premises_address: '104, Laxmi Road Market, Pune'
  });

  // Public QR Search State
  const [certQuery, setCertQuery] = useState('MH-PUN-2026-00841');
  const [publicCert, setPublicCert] = useState(null);
  const [complaintModal, setComplaintModal] = useState(false);
  const [complaintText, setComplaintText] = useState('');

  // Inspector Form State
  const [inspectModal, setInspectModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [inspectForm, setInspectForm] = useState({
    zero_error: '0.0',
    repeatability_error: '0.01',
    eccentricity_error: '0.02',
    nameplate_match: 'MATCH',
    result: 'PASS'
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [instRes, appRes, riskRes, inspRes, chainRes] = await Promise.all([
        fetch(`${API_BASE}/instruments`).then(r => r.json()),
        fetch(`${API_BASE}/applications`).then(r => r.json()),
        fetch(`${API_BASE}/risk-flags`).then(r => r.json()),
        fetch(`${API_BASE}/risk-flags/inspectors-summary`).then(r => r.json()),
        fetch(`${API_BASE}/integrity/chain-check`).then(r => r.json())
      ]);

      if (instRes.success) setInstruments(instRes.instruments);
      if (appRes.success) setApplications(appRes.applications);
      if (riskRes.success) setRiskFlags(riskRes.risk_flags);
      if (inspRes.success) setInspectorsSummary(inspRes.inspectors);
      if (chainRes.success) setChainStatus(chainRes.report);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRegisterInstrument = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/instruments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(instForm)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Weighing Scale registered with physical nameplate metadata!');
        setNewInstModal(false);
        fetchData();
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Registration failed', 'error');
    }
  };

  const handleApplyVerification = async (instrumentId) => {
    try {
      const res = await fetch(`${API_BASE}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicant_id: 'usr-mer-01',
          instrument_id: instrumentId,
          application_type: 'RE_VERIFICATION',
          scheduled_date: new Date(Date.now() + 3*86400000).toISOString().split('T')[0]
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Allocated Inspector: ${data.assigned_officer.name} via Blind Anti-Collusion Engine!`);
        fetchData();
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Application submission failed', 'error');
    }
  };

  const handleVerifyCert = async (certNum) => {
    try {
      const res = await fetch(`${API_BASE}/certificates/verify/${certNum}`);
      const data = await res.json();
      if (data.success) {
        setPublicCert(data.certificate);
      } else {
        showToast(data.error, 'error');
        setPublicCert(null);
      }
    } catch (err) {
      showToast('Certificate lookup failed', 'error');
    }
  };

  const handleSubmitComplaint = async () => {
    if (!complaintText) return;
    try {
      const res = await fetch(`${API_BASE}/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificate_number: publicCert?.certificate_number,
          description: complaintText,
          complainant_name: 'Concerned Consumer',
          evidence_photo_url: '/uploads/evidence/consumer_short_weight.jpg'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Complaint recorded & inspector risk score updated dynamically!');
        setComplaintModal(false);
        setComplaintText('');
        fetchData();
      }
    } catch (err) {
      showToast('Failed to submit complaint', 'error');
    }
  };

  const handleSubmitInspection = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;
    try {
      const res = await fetch(`${API_BASE}/verifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: selectedApp.id,
          instrument_id: selectedApp.instrument_id,
          officer_id: selectedApp.assigned_officer_id || 'usr-lmo-01',
          zero_error: parseFloat(inspectForm.zero_error),
          repeatability_error: parseFloat(inspectForm.repeatability_error),
          eccentricity_error: parseFloat(inspectForm.eccentricity_error),
          overall_result: inspectForm.result,
          photo_url: '/uploads/evidence/live_scale_display.jpg',
          geo_lat: 18.5167,
          geo_lng: 73.8562,
          nameplate_match_status: inspectForm.nameplate_match
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Verification recorded! Block Hash: ${data.record_hash.substring(0, 12)}... (Linked to chain)`);
        setInspectModal(false);
        fetchData();
      } else {
        showToast(data.error, 'error');
      }
    } catch (err) {
      showToast('Verification failed', 'error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <header style={{ background: '#1e293b', color: '#fff', padding: '14px 24px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#2563eb', padding: '8px', borderRadius: '8px', display: 'flex' }}>
              <Scale size={24} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.5px' }}>VerifyMET+</span>
                <span style={{ fontSize: '0.7rem', background: '#059669', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>LAYER 1 READY</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Legal Metrology Online Verification & Cryptographic Integrity Platform</p>
            </div>
          </div>

          {/* Role Switcher */}
          <div style={{ display: 'flex', background: '#0f172a', padding: '4px', borderRadius: '8px', gap: '4px' }}>
            <button 
              onClick={() => setActiveRole('admin')}
              style={{
                background: activeRole === 'admin' ? '#2563eb' : 'transparent',
                color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <ShieldCheck size={16} /> Admin & Integrity
            </button>
            <button 
              onClick={() => setActiveRole('merchant')}
              style={{
                background: activeRole === 'merchant' ? '#2563eb' : 'transparent',
                color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Scale size={16} /> Shop Owner
            </button>
            <button 
              onClick={() => setActiveRole('inspector')}
              style={{
                background: activeRole === 'inspector' ? '#2563eb' : 'transparent',
                color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <UserCheck size={16} /> LMO Inspector
            </button>
            <button 
              onClick={() => { setActiveRole('public'); handleVerifyCert(certQuery); }}
              style={{
                background: activeRole === 'public' ? '#2563eb' : 'transparent',
                color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <QrCode size={16} /> Public QR Portal
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#10b981', color: '#fff',
          padding: '12px 20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: '500'
        }}>
          {toast.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.msg}
        </div>
      )}

      {/* Main Workspace View */}
      <main style={{ maxWidth: '1280px', margin: '24px auto', padding: '0 20px', flex: 1, width: '100%' }}>
        
        {/* VIEW 1: ADMIN & INTEGRITY DASHBOARD */}
        {activeRole === 'admin' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a' }}>State Legal Metrology Controller Dashboard</h1>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Real-time surveillance, behavioral fraud detection & cryptographic audit log</p>
              </div>
              <button 
                onClick={fetchData}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#e2e8f0', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Data
              </button>
            </div>

            {/* Cryptographic Chain Status Banner */}
            <div style={{
              background: chainStatus?.valid ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${chainStatus?.valid ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: '10px', padding: '16px', marginBottom: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: chainStatus?.valid ? '#22c55e' : '#ef4444', color: '#fff', padding: '10px', borderRadius: '8px' }}>
                  <Lock size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '700', color: chainStatus?.valid ? '#166534' : '#991b1b' }}>
                    Cryptographic SHA-256 Hash Chain: {chainStatus?.valid ? 'SECURE & INTACT' : 'TAMPER DETECTED!'}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                    {chainStatus?.message} Head Hash: <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>{chainStatus?.head_hash?.substring(0, 20)}...</code>
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Verified Blocks</span>
                <p style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>{chainStatus?.count || 0}</p>
              </div>
            </div>

            {/* Red-Flag Anomaly Engine Section (Uniqueness) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '28px' }}>
              
              {/* Behavioral Anomaly Card */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle color="#dc2626" size={20} />
                    <h2 style={{ fontSize: '1rem', fontWeight: '700' }}>Active Behavioral Red-Flags</h2>
                  </div>
                  <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '12px' }}>
                    {riskFlags.length} Anomalies
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {riskFlags.map((flag) => (
                    <div key={flag.id} style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#9f1239' }}>{flag.flag_type}</span>
                        <span style={{ background: '#be123c', color: '#fff', fontSize: '0.7rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px' }}>
                          Risk: {flag.score}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#4c0519', marginBottom: '4px' }}>
                        <strong>Target:</strong> {flag.details?.officer_name || flag.entity_type}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#881337', lineHeight: '1.4' }}>
                        {flag.details?.reason || flag.details?.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inspector Integrity Roster (Clean vs Flagged) */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserCheck color="#2563eb" size={20} />
                    <h2 style={{ fontSize: '1rem', fontWeight: '700' }}>Inspector Integrity Leaderboard</h2>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Jurisdiction: Pune Urban</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {inspectorsSummary.map((insp) => (
                    <div key={insp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <div>
                        <p style={{ fontWeight: '600', fontSize: '0.85rem' }}>{insp.name}</p>
                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Assigned: {insp.total_assigned} | Verified: {insp.completed_tests}</p>
                      </div>
                      <div>
                        {insp.active_flags > 0 ? (
                          <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: '0.75rem', fontWeight: '700', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertTriangle size={12} /> {insp.active_flags} Flags ({insp.max_risk_score} pts)
                          </span>
                        ) : (
                          <span style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.75rem', fontWeight: '700', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> Clean Profile
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Applications Surveillance Table */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '14px' }}>Verification Applications & Anti-Collusion Allocation Log</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '10px' }}>App No.</th>
                      <th style={{ padding: '10px' }}>Applicant</th>
                      <th style={{ padding: '10px' }}>Instrument</th>
                      <th style={{ padding: '10px' }}>Assigned LMO</th>
                      <th style={{ padding: '10px' }}>Allocation Logic</th>
                      <th style={{ padding: '10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map(app => (
                      <tr key={app.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: '600' }}>{app.application_number}</td>
                        <td style={{ padding: '10px' }}>{app.applicant_name} ({app.org_name})</td>
                        <td style={{ padding: '10px' }}>{app.make} {app.model}</td>
                        <td style={{ padding: '10px', fontWeight: '500' }}>{app.assigned_officer_name || 'Unassigned'}</td>
                        <td style={{ padding: '10px', color: '#475569', fontSize: '0.75rem' }}>{app.assignment_reason}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ 
                            background: app.status === 'COMPLETED' ? '#dcfce7' : '#fef3c7', 
                            color: app.status === 'COMPLETED' ? '#166534' : '#92400e',
                            padding: '3px 8px', borderRadius: '12px', fontWeight: '700', fontSize: '0.7rem'
                          }}>
                            {app.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: MERCHANT / SHOP OWNER PORTAL */}
        {activeRole === 'merchant' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Sharma Provisions & Retail Pvt Ltd</h1>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>GST: 27AABCS1429B1Z2 | Location: Laxmi Road Market, Pune</p>
              </div>
              <button 
                onClick={() => setNewInstModal(true)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                + Register New Scale (with Nameplate)
              </button>
            </div>

            {/* WhatsApp Integration Banner */}
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare color="#059669" size={20} />
              <p style={{ fontSize: '0.8rem', color: '#065f46' }}>
                <strong>WhatsApp Channel Active:</strong> Re-verification expiry reminders and digital certificates are delivered directly to registered mobile <strong>+91 9822998811</strong>.
              </p>
            </div>

            {/* Registered Instruments Grid */}
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '14px' }}>My Weighing & Measuring Instruments</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
              {instruments.filter(i => i.owner_id === 'usr-mer-01').map(inst => (
                <div key={inst.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>{inst.make} - {inst.model}</h3>
                      <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Serial No: <code>{inst.serial_number}</code></p>
                    </div>
                    <span style={{ 
                      background: inst.verification_status === 'VERIFIED' ? '#dcfce7' : '#fef3c7',
                      color: inst.verification_status === 'VERIFIED' ? '#15803d' : '#92400e',
                      padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700'
                    }}>
                      {inst.verification_status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: '#334155', marginBottom: '14px', lineHeight: '1.6' }}>
                    <div><strong>Capacity:</strong> {inst.capacity}</div>
                    <div><strong>Class:</strong> {inst.accuracy_class}</div>
                    <div><strong>Physical Binding:</strong> <span style={{ color: inst.last_photo_match_status === 'MATCH' ? '#16a34a' : '#ea580c', fontWeight: '600' }}>Nameplate {inst.last_photo_match_status}</span></div>
                    {inst.certificate_number && (
                      <div style={{ marginTop: '6px', background: '#f8fafc', padding: '6px 8px', borderRadius: '6px' }}>
                        <strong>Certificate:</strong> {inst.certificate_number} (Valid to: {inst.valid_until})
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {inst.verification_status !== 'VERIFIED' ? (
                      <button 
                        onClick={() => handleApplyVerification(inst.id)}
                        style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: '8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}
                      >
                        Apply for Verification (Blind Allocated)
                      </button>
                    ) : (
                      <button 
                        onClick={() => { setActiveRole('public'); handleVerifyCert(inst.certificate_number); }}
                        style={{ flex: 1, background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                      >
                        <QrCode size={14} /> View QR Certificate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Registration Modal */}
            {newInstModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px' }}>Register Instrument with Physical Nameplate</h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '16px' }}>Required under Section 24 of Legal Metrology Act for physical-digital binding</p>
                  
                  <form onSubmit={handleRegisterInstrument} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Manufacturer (Make)</label>
                      <input 
                        type="text" required value={instForm.make} onChange={e => setInstForm({...instForm, make: e.target.value})}
                        placeholder="e.g. Essae-Teraoka"
                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Model</label>
                      <input 
                        type="text" required value={instForm.model} onChange={e => setInstForm({...instForm, model: e.target.value})}
                        placeholder="e.g. DS-215N Counter Scale"
                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Serial Number (as on metallic plate)</label>
                      <input 
                        type="text" required value={instForm.serial_number} onChange={e => setInstForm({...instForm, serial_number: e.target.value})}
                        placeholder="e.g. ESS-2026-88192"
                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Capacity & Least Count</label>
                      <input 
                        type="text" required value={instForm.capacity} onChange={e => setInstForm({...instForm, capacity: e.target.value})}
                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      />
                    </div>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Camera size={16} color="#2563eb" />
                        <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>Nameplate Photo Attachment</span>
                      </div>
                      <p style={{ fontSize: '0.7rem', color: '#64748b' }}>Simulated upload of metallic plate photo. Enables tamper prevention algorithm.</p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button type="button" onClick={() => setNewInstModal(false)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: '600' }}>Cancel</button>
                      <button type="submit" style={{ flex: 1, padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600' }}>Submit & Save</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: LMO INSPECTOR FIELD PORTAL */}
        {activeRole === 'inspector' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Inspector Field Execution Portal</h1>
              <p style={{ fontSize: '0.875rem', color: '#64748b' }}>Officer: Rajesh Kumar (LMO-Pune Central) | Clean Integrity Record</p>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '14px' }}>Assigned Field Verifications (Today's Schedule)</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {applications.filter(a => a.status === 'SCHEDULED').map(app => (
                  <div key={app.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{app.application_number}</span>
                        <span style={{ background: '#e0e7ff', color: '#3730a3', fontSize: '0.7rem', fontWeight: '700', padding: '2px 8px', borderRadius: '12px' }}>Blind Assigned</span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#334155', marginTop: '4px' }}><strong>Shop:</strong> {app.org_name} ({app.premises_address})</p>
                      <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Instrument: {app.make} {app.model} (S/N: {app.serial_number})</p>
                    </div>
                    <button 
                      onClick={() => { setSelectedApp(app); setInspectModal(true); }}
                      style={{ background: '#059669', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Camera size={14} /> Conduct Evidence-Bound Test
                    </button>
                  </div>
                ))}
                {applications.filter(a => a.status === 'SCHEDULED').length === 0 && (
                  <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', padding: '20px' }}>No pending scheduled inspections today.</p>
                )}
              </div>
            </div>

            {/* Test Entry Modal (Evidence-Bound) */}
            {inspectModal && selectedApp && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '4px' }}>Conduct Evidence-Bound Verification</h2>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '16px' }}>Application: {selectedApp.application_number} | {selectedApp.make} {selectedApp.model}</p>

                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <MapPin color="#2563eb" size={20} />
                    <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>
                      <div><strong>Geo-Location Enforced:</strong> 18.5167° N, 73.8562° E (Pune)</div>
                      <div><strong>Timestamp:</strong> {new Date().toLocaleTimeString()} (Server Synchronized)</div>
                    </div>
                  </div>

                  <form onSubmit={handleSubmitInspection} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Physical Nameplate Match Check</label>
                      <select 
                        value={inspectForm.nameplate_match} 
                        onChange={e => setInspectForm({...inspectForm, nameplate_match: e.target.value})}
                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      >
                        <option value="MATCH">MATCH (Exact serial number & model match)</option>
                        <option value="MISMATCH">MISMATCH (Serial number swapped / tampered)</option>
                        <option value="NEEDS_REVIEW">UNREADABLE / WORN OUT</option>
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Zero Load Error (e)</label>
                        <input 
                          type="number" step="0.01" value={inspectForm.zero_error} onChange={e => setInspectForm({...inspectForm, zero_error: e.target.value})}
                          style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Repeatability Error (e)</label>
                        <input 
                          type="number" step="0.01" value={inspectForm.repeatability_error} onChange={e => setInspectForm({...inspectForm, repeatability_error: e.target.value})}
                          style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Overall Result</label>
                      <select 
                        value={inspectForm.result} 
                        onChange={e => setInspectForm({...inspectForm, result: e.target.value})}
                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '700', color: inspectForm.result === 'PASS' ? '#15803d' : '#b91c1c' }}
                      >
                        <option value="PASS">PASS (Conforms to Legal Metrology General Rules)</option>
                        <option value="FAIL">FAIL (Exceeds Maximum Permissible Error)</option>
                      </select>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.7rem', color: '#64748b' }}>
                      <strong>Cryptographic Chaining:</strong> Submitting will compute a SHA-256 hash linking this inspection to the previous block.
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button type="button" onClick={() => setInspectModal(false)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: '600' }}>Cancel</button>
                      <button type="submit" style={{ flex: 1, padding: '10px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600' }}>Submit & Hash-Chain</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: PUBLIC CITIZEN QR AUTHENTICATION PORTAL */}
        {activeRole === 'public' && (
          <div style={{ maxWidth: '680px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', background: '#dbeafe', padding: '12px', borderRadius: '50%', marginBottom: '12px' }}>
                <QrCode size={36} color="#1d4ed8" />
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Legal Metrology Certificate Authentication</h1>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Official Government of India Verification Portal under Section 24 of the Act</p>
            </div>

            {/* Search Input Box */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              <input 
                type="text" 
                value={certQuery} 
                onChange={e => setCertQuery(e.target.value)}
                placeholder="Enter Certificate Number e.g. MH-PUN-2026-00841"
                style={{ flex: 1, padding: '12px 16px', border: '2px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600' }}
              />
              <button 
                onClick={() => handleVerifyCert(certQuery)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: '700', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Search size={16} /> Verify
              </button>
            </div>

            {/* Certificate Display Card */}
            {publicCert && (
              <div style={{ background: '#fff', border: '2px solid #059669', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#059669', textTransform: 'uppercase' }}>Authentic Legal Certificate</span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>{publicCert.certificate_number}</h2>
                  </div>
                  <span style={{ background: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: '20px', fontWeight: '800', fontSize: '0.85rem' }}>
                    ● {publicCert.status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.85rem', marginBottom: '20px' }}>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.75rem' }}>Shop / Merchant</p>
                    <p style={{ fontWeight: '700' }}>{publicCert.merchant.organization}</p>
                    <p style={{ fontSize: '0.75rem', color: '#475569' }}>{publicCert.instrument.premises_address}</p>
                  </div>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.75rem' }}>Weighing Instrument</p>
                    <p style={{ fontWeight: '700' }}>{publicCert.instrument.make} {publicCert.instrument.model}</p>
                    <p style={{ fontSize: '0.75rem', color: '#475569' }}>Serial No: <code>{publicCert.instrument.serial_number}</code></p>
                  </div>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.75rem' }}>Certificate Validity</p>
                    <p style={{ fontWeight: '700', color: '#15803d' }}>Valid until {publicCert.valid_until}</p>
                  </div>
                  <div>
                    <p style={{ color: '#64748b', fontSize: '0.75rem' }}>Verified By LMO</p>
                    <p style={{ fontWeight: '700' }}>{publicCert.inspector.name}</p>
                    <p style={{ fontSize: '0.7rem', color: '#64748b' }}>Block: <code>{publicCert.inspector.record_hash?.substring(0, 16)}...</code></p>
                  </div>
                </div>

                {/* Report a Concern Button (Citizen Feedback Loop) */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Notice discrepancy or short-weighting?</span>
                  <button 
                    onClick={() => setComplaintModal(true)}
                    style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '8px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <AlertTriangle size={14} /> Report a Concern (No Login)
                  </button>
                </div>
              </div>
            )}

            {/* Complaint Modal */}
            {complaintModal && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '480px', width: '100%' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '6px' }}>Report Short-Weighting / Instrument Concern</h2>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '14px' }}>Certificate: {publicCert?.certificate_number} | Automatically flags inspector & merchant in system</p>
                  
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Describe Observed Discrepancy</label>
                    <textarea 
                      rows={3} 
                      value={complaintText} 
                      onChange={e => setComplaintText(e.target.value)}
                      placeholder="e.g. Weighing 1 kg of rice showed 900g on standard scale. Scale sticker appears peeled."
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setComplaintModal(false)} style={{ flex: 1, padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontWeight: '600' }}>Cancel</button>
                    <button onClick={handleSubmitComplaint} style={{ flex: 1, padding: '10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600' }}>Submit Report</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer style={{ background: '#0f172a', color: '#94a3b8', padding: '16px 24px', fontSize: '0.75rem', borderTop: '1px solid #1e293b' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            VerifyMET+ Integrity System | Legal Metrology Act, 2009 & General Rules, 2011
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Layer 1 Foundation</span>
            <span>SHA-256 Hash Chain</span>
            <span>Blind Allocation</span>
            <span>DPDP Act 2023 Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
