import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Smartphone, Zap, Split, Lock, CheckCircle, 
  ExternalLink, AtSign, ShieldCheck, Hash, Info, 
  Clock, AlertTriangle, RefreshCcw, ArrowRight, XCircle, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// --- Configuration & Constants ---
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
const TOTAL_ORDER_AMOUNT = 80000;
const SESSION_TTL = 10 * 60; // 10 Minutes in seconds

const App = () => {
  // Session State
  const [session, setSession] = useState(null);
  const [step, setStep] = useState('configuration'); // configuration | card-sdk | upi-intent | success | failure
  const [timeLeft, setTimeLeft] = useState(SESSION_TTL);
  const [timerActive, setTimerActive] = useState(false);
  const [errorStatus, setErrorStatus] = useState(null); // SESSION_TIMEOUT | UPI_PAYMENT_FAILED | USER_CANCELLED
  
  // Amounts
  const [cardAmt, setCardAmt] = useState(50000);
  const upiAmt = TOTAL_ORDER_AMOUNT - cardAmt;

  // UI Flow States
  const [loading, setLoading] = useState(false);
  const [showBottomSDK, setShowBottomSDK] = useState(false);

  // --- Session Timer (State Persistence) ---
  useEffect(() => {
    let interval;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setStep('failure');
      setErrorStatus("SESSION_TIMEOUT");
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  // --- Orchestration Methods ---
  
  // Step 1: Initialize Session
  const initializeSession = async () => {
    // Basic sanitization and range validation
    const portion = Number(String(cardAmt).replace(/[^0-9.]/g, ''));
    
    if (isNaN(portion) || portion <= 0) {
      alert("Please enter a valid numerical amount for the card portion.");
      return;
    }

    if (portion >= TOTAL_ORDER_AMOUNT) {
      alert(`Invalid Allotment: Card portion (₹${portion.toLocaleString()}) must be less than the total order amount (₹${TOTAL_ORDER_AMOUNT.toLocaleString()}) to enable a split payment.`);
      return;
    }

    if (portion < 1000) {
      alert("Minimum card allotment for orchestration is ₹1,000.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/orchestrate/initialize`, {
        totalAmount: TOTAL_ORDER_AMOUNT,
        cardLegAmount: cardAmt
      });
      setSession(data);
      setStep('card-sdk');
      setTimerActive(true); 
    } catch (err) {
      alert("Orchestration Service Offline. Please ensure 'npm run dev' is active in the server folder.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Trigger Leg 1 (Card) - Bottom Sheet Simulation
  const triggerCardSDK = () => {
    setShowBottomSDK(true);
    // Simulate Razorpay Auth Delay (Bank verification)
    setTimeout(async () => {
      try {
        await axios.post(`${API_BASE}/orchestrate/leg1-complete`, {
          sessionID: session.sessionID,
          txID: `AZ_CARD_${Math.random().toString(36).substring(7).toUpperCase()}`
        });
        setShowBottomSDK(false);
        setStep('upi-intent');
      } catch (err) {
        setShowBottomSDK(false);
        setErrorStatus("API_DISRUPTION");
        setStep('failure');
      }
    }, 3000);
  };

  // Step 3: Leg 2 (UPI) - Reconciliation finalize
  const finalizePayment = async () => {
    setLoading(true);
    // Simulated Reconciliation Window
    setTimeout(async () => {
      try {
        const { data } = await axios.post(`${API_BASE}/orchestrate/finalize`, {
          sessionID: session.sessionID,
          txID: `AZ_UPI_${Math.random().toString(36).substring(7).toUpperCase()}`
        });
        setSession(data.receipt);
        setStep('success');
        setTimerActive(false);
      } catch (err) {
        setErrorStatus("UPI_PAYMENT_FAILED");
        setStep('failure');
        setTimerActive(false);
      } finally {
        setLoading(false);
      }
    }, 2500);
  };

  const restartFlow = () => window.location.reload();

  return (
    <div className="orchestrator-shell">
      <motion.div 
        className="main-card glass"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <ProgressDots step={step} />

        <AnimatePresence mode="wait">
          {/* CONFIG SCREEN */}
          {step === 'configuration' && (
            <motion.div key="config" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
              <div className="header-badge">Multi-Leg Orchestration</div>
              <h1 style={{ fontSize: '36px', marginBottom: '12px', lineHeight: 1.1, fontWeight: 800 }}>One Bill.<br/>Two Methods.</h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '15px' }}>Solve daily bank limits on high-value settlements.</p>

              <div className="input-field-wrapper">
                <label className="input-label">CARD PORTION (LEG 1)</label>
                <div className="input-container">
                  <Split size={22} className="input-icon" />
                  <input type="number" value={cardAmt} onChange={(e) => setCardAmt(Number(e.target.value))} placeholder="Amount via Card" />
                </div>
              </div>

              <div className="leg-card">
                <LegRow icon={<CreditCard size={22} />} label="Leg 1: Card Allotment" amount={cardAmt} active={true} />
                <div className="leg-connector"></div>
                <LegRow icon={<Smartphone size={22} />} label="Leg 2: UPI Intent Balance" amount={upiAmt} active={false} />
              </div>

              <button className="btn-action" onClick={initializeSession} disabled={loading}>
                {loading ? <div className="loader-ring"></div> : <><span>Initialize Multi-Leg Flow</span> <Zap size={18} /></>}
              </button>
            </motion.div>
          )}

          {/* CARD LEG SCREEN */}
          {step === 'card-sdk' && (
            <motion.div key="card" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
              <div className="header-badge">Action Required: Leg 1</div>
              <h1 style={{ marginBottom: '12px', fontSize: '32px' }}>Payment Bridge</h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '15px' }}>Initializing Razorpay SDK for portion authorization.</p>
              
              <div className="leg-card" style={{ background: 'var(--surface-lighter)', borderStyle: 'dashed', textAlign: 'center', padding: '40px 24px' }}>
                <ShieldCheck size={56} color="var(--primary-accent)" style={{ marginBottom: '16px', opacity: 0.9 }} />
                <div style={{ fontWeight: '800', fontSize: '18px', marginBottom: '6px' }}>Bank Auth Ready</div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', letterSpacing: '0.5px' }}>PCI-DSS TIER 1 ENCRYPTION ACTIVE</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="btn-action" onClick={triggerCardSDK}>
                  <span>Pay ₹{cardAmt.toLocaleString()} via Card</span>
                  <ChevronRight size={20} />
                </button>
                <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)', marginTop: '16px', cursor: 'pointer', fontWeight: '600' }} onClick={restartFlow}>Discard Session</div>
              </div>
            </motion.div>
          )}

          {/* UPI LEG SCREEN */}
          {step === 'upi-intent' && (
            <motion.div key="upi" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
              <div className="header-badge" style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)' }}>LEG 1 AUTHORIZED</div>
              <h1 style={{ marginBottom: '12px', fontSize: '32px' }}>Final Balance</h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '15px' }}>Settling remaining balance of ₹{upiAmt.toLocaleString()} via UPI.</p>

              <div className="upi-box">
                <UPITile name="Google Pay" icon="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" active={true} />
                <UPITile name="PhonePe" icon="https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="btn-action" onClick={finalizePayment} disabled={loading}>
                  {loading ? <div className="loader-ring"></div> : <><span>Launch App Intent</span> <ExternalLink size={20} /></>}
                </button>
                <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--error)', marginTop: '16px', cursor: 'pointer', fontWeight: '700' }} onClick={() => { setErrorStatus("USER_CANCELLED"); setStep('failure'); }}>
                  ABORT & TRIGGER REFUND
                </div>
              </div>
            </motion.div>
          )}

          {/* SUCCESS SCREEN */}
          {step === 'success' && (
            <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '88px', height: '88px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' }}>
                  <CheckCircle size={44} />
                </div>
                <h1 style={{ fontSize: '36px', marginBottom: '8px' }}>Settled.</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>Orchestration Session: {session?.sessionID}</p>

                <div className="receipt-card">
                  <div className="receipt-line">
                    <span className="receipt-label">Total Amount</span>
                    <span className="receipt-val" style={{ fontSize: '20px' }}>₹{TOTAL_ORDER_AMOUNT.toLocaleString()}</span>
                  </div>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '20px 0' }}></div>
                  <div className="receipt-line"><span className="receipt-label">Leg 1: Card</span><span style={{ color: 'var(--success)', fontWeight: '800', fontSize: '12px' }}>SUCCESSFUL</span></div>
                  <div className="receipt-line"><span className="receipt-label">Leg 2: UPI</span><span style={{ color: 'var(--success)', fontWeight: '800', fontSize: '12px' }}>SUCCESSFUL</span></div>
                </div>

                <button className="btn-action" onClick={restartFlow}>New Transaction</button>
              </div>
            </motion.div>
          )}

          {/* FAILURE SCREEN */}
          {step === 'failure' && (
            <motion.div key="failure" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '88px', height: '88px', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--error)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' }}>
                  <XCircle size={44} />
                </div>
                <h1 style={{ fontSize: '32px', marginBottom: '12px' }}>Interrupted.</h1>
                
                <div style={{ background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.15)', borderRadius: '24px', padding: '24px', marginBottom: '40px', textAlign: 'left' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--error)', fontWeight: '800', fontSize: '12px', marginBottom: '10px' }}>
                    <AlertTriangle size={16} /> RECOVERY LOG: {errorStatus}
                   </div>
                   <p style={{ fontSize: '14px', color: '#fff', fontWeight: '500', marginBottom: '6px' }}>Partial fulfillment could not be reconciled.</p>
                   {session?.legs?.card?.status === 'AUTHORIZED' && (
                     <div style={{ color: 'var(--warning)', fontSize: '12px', lineHeight: 1.4, fontWeight: '600' }}>
                        AUTOMATED REVERSAL: ₹{cardAmt.toLocaleString()} has been flagged for merchant reversal.
                     </div>
                   )}
                </div>

                <button className="btn-action" onClick={restartFlow} style={{ background: 'var(--surface-lighter)', boxShadow: 'none' }}>
                  <RefreshCcw size={18} />
                  <span>Restart Session</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="footer-bar">
          <ShieldCheck size={18} color="var(--success)" />
          <span>Middleware Tier-1 Security • Real-time State Machine</span>
        </div>
      </motion.div>

      {/* RAZORPAY BOTTOM SHEET SIMULATOR */}
      <AnimatePresence>
        {showBottomSDK && (
          <motion.div className="overlay-mask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bottom-sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}>
              <div style={{ width: '48px', height: '5px', background: '#ddd', borderRadius: '3px', margin: '0 auto 28px' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div style={{ fontWeight: '950', fontSize: '22px', letterSpacing: '-1.5px', color: '#111' }}>RAZORPAY</div>
                <div className="header-badge" style={{ marginBottom: 0, background: '#f0f0f0', color: '#666' }}>ID: {session?.sessionID}</div>
              </div>

              <div style={{ background: '#f5f7f9', borderRadius: '24px', padding: '32px 24px', marginBottom: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#999', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '1px' }}>PAYING PORTION 1</div>
                <div style={{ fontSize: '36px', fontWeight: '900', color: '#111' }}>₹{cardAmt.toLocaleString()}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#fff', border: '1.5px solid #eee', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                <div className="loader-ring" style={{ width: '22px', height: '22px' }}></div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#222' }}>Securely authenticating with bank...</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* --- Visual Components --- */

const ProgressDots = ({ step }) => {
  const steps = ['configuration', 'card-sdk', 'upi-intent', 'success'];
  const cur = steps.indexOf(step === 'failure' ? 'upi-intent' : step);
  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '40px' }}>
      {steps.slice(0,3).map((s, i) => (
        <div key={s} style={{ flex: 1, height: '4px', background: i <= cur ? 'var(--primary-accent)' : 'var(--surface-lighter)', borderRadius: '2px', transition: '0.5s var(--transition-smooth)' }}></div>
      ))}
    </div>
  );
};

const LegRow = ({ icon, label, amount, active }) => (
  <div className={`leg-row ${active ? 'active' : ''}`}>
    <div className="leg-icon-box">{icon}</div>
    <div className="leg-detail">
      <h5>{label}</h5>
      <div className="amt">₹{amount.toLocaleString()}</div>
    </div>
  </div>
);

const UPITile = ({ name, icon, active }) => (
  <div className={`upi-tile ${active ? 'active' : ''}`}>
    <img src={icon} alt={name} className="upi-logo" />
    <span style={{ fontSize: '13px', fontWeight: '700' }}>{name}</span>
    {active && <CheckCircle size={12} style={{ position: 'absolute', top: 12, right: 12, color: 'var(--primary-accent)' }} />}
  </div>
);

export default App;
