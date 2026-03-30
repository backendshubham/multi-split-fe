import React, { useState, useEffect } from 'react';
import { 
  CreditCard, Smartphone, Zap, Split, Lock, CheckCircle, 
  ExternalLink, AtSign, ShieldCheck, Hash, Info, 
  Clock, AlertTriangle, RefreshCcw, ArrowRight, XCircle, ChevronRight, IndianRupee, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

// --- Configuration & Constants ---
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_Rg4E21Iy1gxlp8";
const SESSION_TTL = 10 * 60; 

const App = () => {
    // --- Centralized Payment State ---
    const [step, setStep] = useState('configuration'); // configuration | card-sdk | upi-intent | success | failure
    const [totalAmt, setTotalAmt] = useState(80000);
    const [cardAmt, setCardAmt] = useState(50000);
    const upiAmt = totalAmt - cardAmt;
    
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isPinging, setIsPinging] = useState(false);
    const [selectedUPI, setSelectedUPI] = useState('Google Pay');

    // --- High-Fidelity Initialization (Service Wake-up) ---
    useEffect(() => {
        const wakeUp = async () => {
            try { await axios.get(API_BASE.replace('/api', '')); } catch (err) {}
        };
        wakeUp();

        // Injecting RZP SDK
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        return () => { document.body.contains(script) && document.body.removeChild(script); };
    }, []);

    // --- State Machine Handlers ---

    // [1] INITIALIZE SESSION
    const startOrchestration = async () => {
        const cardVal = Number(cardAmt);
        if (cardVal >= totalAmt || cardVal < 1000) {
            alert(`Invalid Card Allotment! Must be ₹1,000 to ₹${(totalAmt - 1).toLocaleString()}.`);
            return;
        }

        setLoading(true);
        try {
            const { data } = await axios.post(`${API_BASE}/orchestrate/initialize`, {
                totalAmount: totalAmt,
                cardLegAmount: cardAmt 
            });
            setSession(data);
            setStep('card-sdk');
        } catch (err) {
            alert("Orchestration Outage Detected. Confirm backend is online.");
        } finally {
            setLoading(false);
        }
    };

    // [2] LAUNCH REAL RAZORPAY GATEWAY
    const openCardGateway = () => {
        if (!window.Razorpay) {
            alert("Payment Bridge Not Initialized. Please wait or refresh.");
            return;
        }

        const options = {
            key: RAZORPAY_KEY,
            amount: Math.round(session.legs.card.amount * 100), // Enforcing Paise Integer
            currency: "INR",
            name: "Tier-1 Middle-Ware Payment",
            description: `Leg 1: Card Allotment ₹${session.legs.card.amount.toLocaleString()}`,
            order_id: session.rzpOrderID,
            handler: async (resp) => {
                setLoading(true);
                try {
                    await axios.post(`${API_BASE}/orchestrate/leg1-complete`, {
                        sessionID: session.sessionID,
                        rzpPaymentID: resp.razorpay_payment_id
                    });
                    setStep('upi-intent');
                } catch (err) {
                    setStep('failure');
                } finally {
                    setLoading(false);
                }
            },
            prefill: { email: "customer@example.com", contact: "9999999999" },
            theme: { color: "#8b5cf6" },
            modal: { on_dismiss: () => setLoading(false) }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
    };

    // [3] REDIRECT TO UPI INTENT
    const triggerUPIApp = (appName) => {
        setSelectedUPI(appName);
        
        // Deep Link intent format
        const vpa = "test@upi";
        const upiLink = `upi://pay?pa=${vpa}&pn=Orchestrator&am=${upiAmt}&cu=INR&tn=Multi-Leg-Finalization`;
        
        window.location.href = upiLink;

        setLoading(true);
        // Reconciliation Latency Sim
        setTimeout(async () => {
            try {
                const { data } = await axios.post(`${API_BASE}/orchestrate/finalize`, {
                    sessionID: session.sessionID,
                    txID: `UPI_CAPT_${Math.random().toString(36).substring(7).toUpperCase()}`
                });
                setSession(data.receipt);
                setStep('success');
            } catch (err) {
                setStep('failure');
            } finally {
                setLoading(false);
            }
        }, 2500);
    };

    return (
        <div className="orchestrator-shell">
            <motion.div className="main-card glass" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                <ProgressStepper step={step} />

                <AnimatePresence mode="wait">
                    {/* --- CONFIGURATION --- */}
                    {step === 'configuration' && (
                        <motion.div key="config" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                            <div className="header-badge">High-Fidelity Orchestration Layer</div>
                            <h1 style={{ fontSize: '34px', marginBottom: '32px', fontWeight: 800, letterSpacing: '-1.5px' }}>One Bill.<br/>Two Methods.</h1>
                            
                            <InputBox label="Total Transaction" val={totalAmt} setVal={setTotalAmt} icon={<IndianRupee size={18}/>} />
                            <InputBox label="Leg 1: Card Portion" val={cardAmt} setVal={setCardAmt} icon={<Split size={18}/>} />

                            <div className="leg-card" style={{ marginBottom: '40px' }}>
                                <LegVisual icon={<CreditCard size={20}/>} label="Leg 1: Card Allotment" amount={cardAmt} active={true} />
                                <div className="leg-connector"></div>
                                <LegVisual icon={<Smartphone size={20}/>} label="Leg 2: UPI Final Balance" amount={upiAmt} active={false} />
                            </div>

                            <button className="btn-action" onClick={startOrchestration} disabled={loading}>
                                {loading ? <div className="loader-ring"></div> : <><span>Initialize Multi-Leg Flow</span> <Zap size={18} /></>}
                            </button>
                        </motion.div>
                    )}

                    {/* --- CARD GATEWAY --- */}
                    {step === 'card-sdk' && (
                        <motion.div key="card" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                            <div className="header-badge">Leg 1 Authorization</div>
                            <h1 style={{ marginBottom: '12px', fontSize: '32px' }}>Payment Bridge</h1>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '15px' }}>Settling ₹{cardAmt.toLocaleString()} via secure gateway.</p>
                            <div className="leg-card" style={{ borderStyle: 'dashed', textAlign: 'center', padding: '40px 24px' }}>
                                <ShieldCheck size={56} color="var(--primary-accent)" style={{ marginBottom: '16px' }} />
                                <div style={{ fontSize: '12px', color: 'var(--text-dim)', letterSpacing: '0.8px', fontWeight: '800' }}>PCI-DSS COMPLIANT TIER-1 ENCRYPTION</div>
                            </div>
                            <button className="btn-action" onClick={openCardGateway} disabled={loading}>
                                 {loading ? <div className="loader-ring"></div> : <span>Pay ₹{cardAmt.toLocaleString()} via Card</span>}
                            </button>
                        </motion.div>
                    )}

                    {/* --- UPI INTENT --- */}
                    {step === 'upi-intent' && (
                        <motion.div key="upi" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                            <div className="header-badge" style={{ color: 'var(--success)', background: 'rgba(16,185,129,0.1)' }}>LEG 1 AUTHORIZED ✅</div>
                            <h1 style={{ marginBottom: '12px', fontSize: '32px' }}>Final Balance</h1>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Choose your app for the remaining ₹{upiAmt.toLocaleString()}.</p>
                            <div className="upi-box">
                                <UPITile name="Google Pay" icon="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg" active={selectedUPI === 'Google Pay'} onClick={() => triggerUPIApp('Google Pay')} />
                                <UPITile name="PhonePe" icon="https://upload.wikimedia.org/wikipedia/commons/7/71/PhonePe_Logo.svg" active={selectedUPI === 'PhonePe'} onClick={() => triggerUPIApp('PhonePe')} />
                            </div>
                            {loading && <div style={{ textAlign: 'center', marginTop: '20px' }}><div className="loader-ring" style={{ margin: '0 auto' }}></div><p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-dim)' }}>Reconciling with Gateway...</p></div>}
                        </motion.div>
                    )}

                    {/* --- RECEIPT --- */}
                    {step === 'success' && (
                        <motion.div key="success" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ width: '88px', height: '88px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px' }}>
                                    <CheckCircle size={44} />
                                </div>
                                <h1 style={{ fontSize: '36px', letterSpacing: '-1px' }}>Paid In Full.</h1>
                                <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Orchestration Session ID: {session?.sessionID}</p>
                                <div className="receipt-card">
                                    <ReceiptLine label="Total Transaction" val={`₹${totalAmt.toLocaleString()}`} bold />
                                    <ReceiptLine label="Leg 1: Card" val={`₹${cardAmt.toLocaleString()} (CAPTURED)`} />
                                    <ReceiptLine label="Leg 2: UPI" val={`₹${upiAmt.toLocaleString()} (SETTLED)`} />
                                </div>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button className="btn-action" onClick={() => window.location.reload()} style={{ flex: 1, background: 'var(--surface-lighter)', color: '#fff', boxShadow: 'none' }}>Done</button>
                                    <button className="btn-action" style={{ flex: 0.2 }}><Share2 size={18}/></button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="footer-bar"><Lock size={14}/><span>Tier-1 Middle-Ware Secure • Real-time State Machine Engine</span></div>
            </motion.div>
        </div>
    );
};

/* --- Visual Sub-Components --- */

const ProgressStepper = ({ step }) => {
    const steps = ['configuration', 'card-sdk', 'upi-intent', 'success'];
    return (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
            {steps.map((s, i) => (
                <div key={s} style={{ flex: 1, height: '4px', background: i <= steps.indexOf(step) ? 'var(--primary-accent)' : 'var(--surface-lighter)', borderRadius: '2px', transition: '0.4s ease' }}></div>
            ))}
        </div>
    );
};

const InputBox = ({ label, val, setVal, icon }) => (
    <div className="input-field-wrapper">
        <label className="input-label">{label}</label>
        <div className="input-container">
            <span className="input-icon">{icon}</span>
            <input type="number" value={val} onChange={(e) => setVal(Number(e.target.value))} placeholder="Amount..." />
        </div>
    </div>
);

const LegVisual = ({ icon, label, amount, active }) => (
    <div className={`leg-row ${active ? 'active' : ''}`}>
        <div className="leg-icon-box">{icon}</div>
        <div className="leg-detail">
            <h5>{label}</h5>
            <div className="amt">₹{amount.toLocaleString()}</div>
        </div>
    </div>
);

const UPITile = ({ name, icon, active, onClick }) => (
    <div className={`upi-tile ${active ? 'active' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
        <img src={icon} alt={name} className="upi-logo" />
        <span style={{ fontSize: '13px', fontWeight: '800' }}>{name}</span>
        {active && <CheckCircle size={14} style={{ position: 'absolute', top: 12, right: 12, color: 'var(--primary-accent)' }} />}
    </div>
);

const ReceiptLine = ({ label, val, bold }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{label}</span>
        <span style={{ fontSize: '14px', fontWeight: bold ? '900' : '600', color: bold ? '#fff' : 'inherit' }}>{val}</span>
    </div>
);

export default App;
