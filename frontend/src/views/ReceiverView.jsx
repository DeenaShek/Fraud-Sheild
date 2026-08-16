import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { 
  Wallet, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowDownLeft, 
  User, 
  Zap, 
  RefreshCw,
  Lock,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';

export function ReceiverView({ onSelectTransaction }) {
  const { socket } = useSocket();
  const [customers, setCustomers] = useState([]);
  const [receiverId, setReceiverId] = useState('CUST-3310'); // Default: Ananya Deshmukh
  const [walletBalance, setWalletBalance] = useState(42300);
  const [incomingTransactions, setIncomingTransactions] = useState([]);
  const [latestHeldAlert, setLatestHeldAlert] = useState(null);
  const [pulseBalance, setPulseBalance] = useState(false);

  // Fetch all customers on initial load
  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.getCustomers();
        if (data.customers && data.customers.length > 0) {
          setCustomers(data.customers);
          const initial = data.customers.find(c => c.customerId === receiverId) || data.customers[0];
          if (initial) {
            setWalletBalance(initial.walletBalance || 42300);
            if (initial.pendingReceipts) {
              setIncomingTransactions(initial.pendingReceipts);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load receiver data:', err);
      }
    }
    loadData();
  }, []);

  // When receiver selection changes
  const handleReceiverChange = (newId) => {
    setReceiverId(newId);
    const selected = customers.find(c => c.customerId === newId);
    if (selected) {
      setWalletBalance(selected.walletBalance || 50000);
      setLatestHeldAlert(null);
    }
  };

  // Listen to live Socket.IO events for live cross-tab updates!
  useEffect(() => {
    if (!socket) return;

    const handlePaymentSettled = (data) => {
      // Check if this payment is destined for the active receiver
      if (data.receiverId === receiverId) {
        setWalletBalance(prev => prev + Number(data.amount));
        setPulseBalance(true);
        setTimeout(() => setPulseBalance(false), 2000);

        setIncomingTransactions(prev => [
          {
            transactionId: data.transactionId,
            senderId: data.senderId,
            senderName: data.senderName,
            amount: Number(data.amount),
            riskBand: data.riskBand,
            status: 'SETTLED',
            timestamp: new Date().toLocaleTimeString()
          },
          ...prev.slice(0, 19)
        ]);

        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    };

    const handlePaymentHeld = (data) => {
      if (data.receiverId === receiverId) {
        setLatestHeldAlert(data);

        setIncomingTransactions(prev => [
          {
            transactionId: data.transactionId,
            senderId: data.senderId,
            senderName: data.senderName,
            amount: Number(data.amount),
            riskBand: data.riskBand,
            reasons: data.reasons,
            status: 'HELD_FOR_REVIEW',
            timestamp: new Date().toLocaleTimeString()
          },
          ...prev.slice(0, 19)
        ]);
      }
    };

    socket.on('payment_settled', handlePaymentSettled);
    socket.on('payment_held', handlePaymentHeld);

    return () => {
      socket.off('payment_settled', handlePaymentSettled);
      socket.off('payment_held', handlePaymentHeld);
    };
  }, [socket, receiverId]);

  const currentReceiver = customers.find(c => c.customerId === receiverId) || {
    name: 'Ananya Deshmukh',
    homeLocation: 'Mumbai, India',
    knownDevices: ['D301']
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header Banner */}
      <div className="glass-panel-elevated p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1.5">
              <Wallet className="w-3 h-3" />
              <span>LIVE BENEFICIARY WALLET</span>
            </span>
            <span className="text-xs font-mono text-slate-400">Live Peer Ledger</span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1">
            Receiver Inbound Ledger
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time balance updates and automated fraud hold interceptor.
          </p>
        </div>

        {/* Switch Active Receiver Account */}
        <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex items-center gap-3">
          <User className="w-4 h-4 text-emerald-400" />
          <div className="text-xs font-mono">
            <span className="text-[10px] text-slate-500 block uppercase">Active Receiver Account:</span>
            <select
              value={receiverId}
              onChange={(e) => handleReceiverChange(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-bold font-mono focus:outline-none focus:border-emerald-500"
            >
              {customers.map(c => (
                <option key={c.customerId} value={c.customerId}>
                  {c.name} ({c.homeLocation})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Balance Display Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Wallet Balance Hero Card (7 cols) */}
        <div className="md:col-span-7 glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Verified Available Balance
            </span>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Live Synced</span>
            </span>
          </div>

          <div className={`transition-all duration-300 ${pulseBalance ? 'scale-105 text-emerald-300' : ''}`}>
            <div className="text-4xl sm:text-5xl font-extrabold font-mono text-white tracking-tight">
              ₹{walletBalance.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1">
              Beneficiary: <strong className="text-slate-200">{currentReceiver.name}</strong> • Location: <strong>{currentReceiver.homeLocation}</strong>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Primary Account: <strong>{receiverId}</strong></span>
            <span>Settlement Mode: <strong>Instant RTGS / IMPS</strong></span>
          </div>
        </div>

        {/* Live Status Summary Card (5 cols) */}
        <div className="md:col-span-5 glass-panel p-6 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Automated Defense Status
            </span>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Normal Transfers:</span>
                <span className="text-emerald-400 font-bold">Auto-Settled (0s)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Anomalous Inbounds:</span>
                <span className="text-rose-400 font-bold">Auto-Held in Escrow</span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/50 text-[11px] font-mono text-cyan-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>Open Sender tab side-by-side to test cross-tab real-time settlement!</span>
          </div>
        </div>

      </div>

      {/* Held for Fraud Review Banner (If active anomaly intercepted) */}
      {latestHeldAlert && (
        <div className="glass-panel p-5 rounded-2xl border border-rose-900 bg-rose-950/40 space-y-3 animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">
                    INCOMING TRANSFER HELD FOR FRAUD REVIEW
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-rose-950 text-rose-300 border border-rose-800">
                    {latestHeldAlert.riskBand} ({latestHeldAlert.ruleScore || 100} pts)
                  </span>
                </div>
                <p className="text-xs text-rose-200 font-mono mt-1">
                  Attempted transfer of <strong className="text-white">₹{Number(latestHeldAlert.amount).toLocaleString('en-IN')}</strong> from <strong className="text-white">{latestHeldAlert.senderName}</strong> was intercepted by FraudShield.
                </p>
                <div className="mt-2 text-xs font-mono text-rose-300 space-y-1">
                  <span className="text-[10px] uppercase text-rose-400 font-bold block">Interception Rationale:</span>
                  {(latestHeldAlert.reasons || ['High-risk behavioral deviation', 'Unrecognized device / location anomaly']).map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {onSelectTransaction && (
              <button
                onClick={() => onSelectTransaction(latestHeldAlert.transactionId)}
                className="px-3.5 py-2 bg-rose-900/80 hover:bg-rose-800 text-white font-mono text-xs font-bold rounded-xl border border-rose-700 shrink-0 transition-all"
              >
                Inspect Case Dossier →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Inbound Transactions Ledger Table */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            <span>Recent Inbound Transactions Ledger</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {incomingTransactions.length} Recorded
          </span>
        </div>

        {incomingTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Transaction ID</th>
                  <th className="py-2.5 px-3">Sender</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Risk Assessment</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {incomingTransactions.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-bold text-cyan-400">{tx.transactionId}</td>
                    <td className="py-2.5 px-3 text-white">{tx.senderName || tx.senderId}</td>
                    <td className="py-2.5 px-3 font-bold text-white">₹{Number(tx.amount).toLocaleString('en-IN')}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${
                        tx.riskBand === 'CRITICAL' ? 'badge-crit' :
                        tx.riskBand === 'HIGH' ? 'badge-high' :
                        tx.riskBand === 'MEDIUM' ? 'badge-med' : 'badge-low'
                      }`}>
                        {tx.riskBand || 'LOW'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {tx.status === 'SETTLED' ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Credited</span>
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Held in Review</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">{tx.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 font-mono text-xs space-y-1">
            <Clock className="w-6 h-6 mx-auto text-slate-600 mb-2" />
            <p>No incoming payments received yet for {currentReceiver.name}.</p>
            <p className="text-[10px] text-slate-600">Send a payment from the Sender tab to see it settle or trigger an alert live.</p>
          </div>
        )}

      </div>

    </div>
  );
}
