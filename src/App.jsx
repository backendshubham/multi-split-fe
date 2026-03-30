import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Smartphone, Zap, Split, Lock, CheckCircle, 
  ExternalLink, AtSign, ShieldCheck, Hash, Info, 
  Clock, AlertTriangle, RefreshCcw, ArrowRight, XCircle, ChevronRight, IndianRupee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// --- Configuration & Constants ---
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
const SESSION_TTL = 10 * 60; 

const App = () => {
  const [session, setSession] = useState(null);
  const [step, setStep] = useState('configuration'); 
  const [timeLeft, setTimeLeft] = useState(SESSION_TTL);
  const [timerActive, setTimerActive] = useState(false);
  
  // Dynamic Allotment State
  const [totalOrderAmt, setTotalOrderAmt] = useState(80000);
  const [cardAmt, setCardAmt] = useState(50000);
  const upiAmt = totalOrderAmt - cardAmt;

  const [loading, setLoading] = useState(false);
  const [selectedUPI, setSelectedUPI] = useState('Google Pay');

  // Load Razorpay Script Dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  // Initial Wake-Up Connection (Render Free Tier Fix)
  useEffect(() => {
    const pingServer = async () => {
      try { await axios.get(API_BASE.replace('/api', '')); } catch (err) {}
    };
    pingServer();
  }, []);

  // Session Timer
  useEffect(() => {
    let interval;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      setStep('failure');
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  // --- Orchestration Methods ---
  
  const initializeSession = async () => {
    const portion = Number(cardAmt);
    if (portion >= totalOrderAmt || portion < 1000) {
      alert(`Invalid Card Portion! Must be between ₹1,000 and ₹${(totalOrderAmt-1).toLocaleString()}.`);
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_BASE}/orchestrate/initialize`, {
        totalAmount: totalOrderAmt,
        cardLegAmount: cardAmt
      });
      setSession(data);
      setStep('card-sdk');
      setTimerActive(true); 
    } catch (err) {
      alert("Orchestrator Offline. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  const triggerCardSDK = () => {
    const options = {
      key: "rzp_test_Rg4E21Iy1gxlp8",
      amount: session.legs.card.amount * 100,
      currency: "INR",
      name: "Orchestration Leg 1",
      order_id: session.rzpOrderID,
      handler: async (response) => {
        setLoading(true);
        try {
          await axios.post(`${API_BASE}/orchestrate/leg1-complete`, {
            sessionID: session.sessionID,
            rzpPaymentID: response.razorpay_payment_id
          });
          setStep('upi-intent');
        } catch (err) {
          setStep('failure');
        } finally {
          setLoading(false);
        }
      },
      prefill: { email: "customer@example.com", contact: "9999999999" },
      theme: { color: "#8b5cf6" }
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const launchUPIIntent = (appName) => {
    setSelectedUPI(appName);
    const vpa = "test@upi";
    const upiLink = `upi://pay?pa=${vpa}&pn=Orchestrator&am=${upiAmt}&cu=INR&tn=Leg2-FinalBalance`;
    
    // Redirect only on mobile
    window.location.href = upiLink;

    // Reconciliation Sim
    setLoading(true);
    setTimeout(async () => {
      try {
        const { data } = await axios.post(`${API_BASE}/orchestrate/finalize`, {
          sessionID: session.sessionID,
          txID: `UPI_ID_${Math.random().toString(36).substring(7).toUpperCase()}`
        });
        setSession(data.receipt);
        setStep('success');
        setTimerActive(false);
      } catch (err) {
        setStep('failure');
      } finally {
        setLoading(false);
      }
    }, 3000);
  };

  const restartFlow = () => window.location.reload();

  return (
    <div className="orchestrator-shell">
      <motion.div className="main-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <ProgressDots step={step} />

        <AnimatePresence mode="wait">
          {step === 'configuration' && (
            <motion.div key="config" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
              <div className="header-badge">Multi-Leg Orchestration</div>
              <h1 style={{ fontSize: '32px', marginBottom: '32px', fontWeight: 800 }}>Split Allotment</h1>

              <div className="input-field-wrapper">
                <label className="input-label">TOTAL ORDER AMOUNT</label>
                <div className="input-container">
                  <IndianRupee size={20} className="input-icon" />
                  <input type="number" value={totalOrderAmt} onChange={(e) => setTotalOrderAmt(Number(e.target.value))} />
                </div>
              </div>

              <div className="input-field-wrapper">
                <label className="input-label">PORTION 1 (PAY VIA CARD)</label>
                <div className="input-container">
                  <Split size={20} className="input-icon" />
                  <input type="number" value={cardAmt} onChange={(e) => setCardAmt(Number(e.target.value))} />
                </div>
              </div>

              <div className="leg-card" style={{ marginBottom: '40px' }}>
                <LegRow icon={<CreditCard size={22} />} label="Portion 1: Card" amount={cardAmt} active={true} />
                <div className="leg-connector"></div>
                <LegRow icon={<Smartphone size={22} />} label="Portion 2: UPI Intent" amount={upiAmt} active={false} />
              </div>

              <button className="btn-action" onClick={initializeSession} disabled={loading}>
                {loading ? <div className="loader-ring"></div> : <><span>Start Live Orchestration</span> <Zap size={18} /></>}
              </button>
            </motion.div>
          )}

          {step === 'card-sdk' && (
            <motion.div key="card" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
              <div className="header-badge">Leg 1: Card Allotment</div>
              <h1 style={{ marginBottom: '12px', fontSize: '32px' }}>Authorized.</h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '40px' }}>Ready to settle ₹{cardAmt.toLocaleString()} via Credit Card.</p>
              
              <button className="btn-action" onClick={triggerCardSDK} disabled={loading}>
                 {loading ? <div className="loader-ring"></div> : <span>Launch Razorpay Gateway</span>}
              </button>
            </motion.div>
          )}

          {step === 'upi-intent' && (
            <motion.div key="upi" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
              <div className="header-badge" style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)' }}>LEG 1 SUCCESS</div>
              <h1 style={{ marginBottom: '12px', fontSize: '32px' }}>Finalize UPI</h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Choose your app for the remaining ₹{upiAmt.toLocaleString()}.</p>

              <div className="upi-box">
                <UPITile name="Google Pay" icon="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" active={selectedUPI === 'Google Pay'} onClick={() => launchUPIIntent('Google Pay')} />
                <UPITile name="PhonePe" icon="https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg" active={selectedUPI === 'PhonePe'} onClick={() => launchUPIIntent('PhonePe')} />
              </div>

              {loading && <div style={{ textAlign: 'center', marginTop: '20px' }}><div className="loader-ring" style={{ margin: '0 auto' }}></div><p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-dim)' }}>Reconciling with Gateway...</p></div>}
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '88px', height: '88px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' }}>
                  <CheckCircle size={44} />
                </div>
                <h1 style={{ fontSize: '36px' }}>Paid.</h1>
                <div className="receipt-card">
                  <ReceiptLine label="Total Order Settled" val={`₹${totalOrderAmt.toLocaleString()}`} bold />
                  <ReceiptLine label="Orchestration ID" val={session?.sessionID} />
                </div>
                <button className="btn-action" onClick={restartFlow}>Reset</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

/* Components */
const ProgressDots = ({ step }) => {
  const steps = ['configuration', 'card-sdk', 'upi-intent', 'success'];
  const cur = steps.indexOf(step);
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
      {steps.map((s, i) => (
        <div key={s} style={{ flex: 1, height: '4px', background: i <= cur ? 'var(--primary-accent)' : 'var(--surface-lighter)', borderRadius: '2px' }}></div>
      ))}
    </div>
  );
};

const LegRow = ({ icon, label, amount, active }) => (
  <div className={`leg-row ${active ? 'active' : ''}`}>
    <div className="leg-icon-box">{icon}</div>
    <div className="leg-detail">
      <h5 style={{ marginBottom: '2px' }}>{label}</h5>
      <div className="amt">₹{amount.toLocaleString()}</div>
    </div>
  </div>
);

const UPITile = ({ name, icon, active, onClick }) => (
  <div className={`upi-tile ${active ? 'active' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
    <img src={icon} alt={name} className="upi-logo" />
    <span style={{ fontSize: '12px', fontWeight: '800' }}>{name}</span>
    {active && <CheckCircle size={14} style={{ position: 'absolute', top: 12, right: 12, color: 'var(--primary-accent)' }} />}
  </div>
);

const ReceiptLine = ({ label, val, bold }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{label}</span>
    <span style={{ fontSize: '14px', fontWeight: bold ? '900' : '600' }}>{val}</span>
  </div>
);

export default App;
