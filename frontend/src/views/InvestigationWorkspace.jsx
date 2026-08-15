import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { NetworkGraphViewer } from '../components/network/NetworkGraphViewer';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Bot, 
  FileText, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  HelpCircle, 
  ChevronRight, 
  ArrowLeft, 
  Smartphone, 
  MapPin, 
  CreditCard, 
  Store, 
  Cpu, 
  Network, 
  History, 
  User 
} from 'lucide-react';
import confetti from 'canvas-confetti';

export function InvestigationWorkspace({ selectedTransactionId, onBack }) {
  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Copilot State
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotHistory, setCopilotHistory] = useState([]);

  // Resolution Modal State
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionAction, setResolutionAction] = useState('BLOCK'); // 'ALLOW' | 'VERIFY' | 'BLOCK'
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionSuccess, setResolutionSuccess] = useState(false);

  // Fetch complete 360 investigation dossier
  useEffect(() => {
    async function fetchDossier() {
      if (!selectedTransactionId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await api.getInvestigationDossier(selectedTransactionId);
        setDossier(data);

        // Pre-populate with initial LLM Case Summary
        if (data.initialCopilotSummary) {
          setCopilotHistory([data.initialCopilotSummary]);
        }
      } catch (err) {
        console.error('Failed to load dossier:', err);
        setError(err.message || 'Failed to load investigation dossier.');
      } finally {
        setLoading(false);
      }
    }
    fetchDossier();
  }, [selectedTransactionId]);

  // Submit Copilot Query (Standard button or custom input)
  const handleQueryCopilot = async (queryText) => {
    const text = queryText || copilotQuery;
    if (!text.trim() || !dossier?.transaction) return;

    try {
      setCopilotLoading(true);
      const res = await api.queryCopilot(dossier.transaction.transactionId, text);
      if (res.copilotResponse) {
        setCopilotHistory(prev => [...prev, res.copilotResponse]);
      }
      setCopilotQuery('');
    } catch (err) {
      console.error('Copilot query error:', err);
    } finally {
      setCopilotLoading(false);
    }
  };

  // Submit Final Case Resolution
  const handleResolveCase = async () => {
    if (!dossier?.transaction) return;
    try {
      setIsResolving(true);
      await api.resolveCase(dossier.transaction.transactionId, resolutionAction, resolutionNotes);
      setResolutionSuccess(true);
      setShowResolutionModal(false);
      
      // Trigger confetti celebration on successful resolution
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });

      // Reload updated dossier
      const updated = await api.getInvestigationDossier(dossier.transaction.transactionId);
      setDossier(updated);
    } catch (err) {
      alert('Failed to resolve case: ' + err.message);
    } finally {
      setIsResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel p-12 rounded-2xl text-center space-y-3">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <h3 className="text-sm font-bold text-white">Assembling 360° Forensic Case Dossier...</h3>
        <p className="text-xs text-slate-400 font-mono">
          Evaluating 6-rule evidence, tabular ML probability, and RAG policies
        </p>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="glass-panel p-12 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h3 className="text-base font-bold text-white">No Active Case Selected</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Please select a suspicious transaction from the Detection Center to inspect its 6-rule breakdown, ML probability, and grounded policy evidence.
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl text-xs transition-all inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Detection Center</span>
        </button>
      </div>
    );
  }

  const { transaction, customer, customerHistory, ruleEvaluation, mlEvaluation, networkContext, retrievedPolicies } = dossier;
  const isResolved = transaction.status.startsWith('RESOLVED');

  return (
    <div className="space-y-6">
      
      {/* Case Header & Action Bar */}
      <div className="glass-panel-elevated p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 transition-all"
            title="Back to Detection Center"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-cyan-400">
                CASE #{transaction.transactionId}
              </span>
              <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                transaction.riskBand === 'CRITICAL' ? 'badge-crit' : 
                transaction.riskBand === 'HIGH' ? 'badge-high' : 
                transaction.riskBand === 'MEDIUM' ? 'badge-med' : 'badge-low'
              }`}>
                {transaction.riskBand} ({transaction.ruleScore}/100)
              </span>
              {isResolved && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {transaction.status}
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-white mt-1">
              Payment of ₹{Number(transaction.amount || 0).toLocaleString('en-IN')} by {customer.name}
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Merchant: {transaction.merchant?.name || transaction.merchant} ({transaction.merchant?.category || 'Retail'}) • Location: {transaction.location}
            </p>
          </div>
        </div>

        {/* Resolution Action Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          {!isResolved ? (
            <button
              onClick={() => setShowResolutionModal(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-cyan-900/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Record Resolution Decision</span>
            </button>
          ) : (
            <div className="text-right">
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 justify-end">
                <CheckCircle2 className="w-4 h-4" />
                <span>Resolved as {transaction.status.replace('RESOLVED_', '')}</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                By {transaction.resolvedBy} on {new Date(transaction.resolvedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: 6-Rule Explainability + ML Meter + Customer Baseline (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Dual Engine Score Banner (Deterministic + ML Tabular) */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>Dual Intelligence Signal Evaluation</span>
              <span className="text-[10px] font-mono text-cyan-400">Additive Separation of Concerns</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Deterministic Rule Score */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Deterministic Rule Score</span>
                  <Cpu className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold font-mono text-white">
                    {ruleEvaluation.totalScore}
                  </span>
                  <span className="text-xs font-mono text-slate-400">/ 100 max</span>
                </div>
                <div className="mt-2">
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        ruleEvaluation.totalScore >= 81 ? 'bg-rose-500' :
                        ruleEvaluation.totalScore >= 61 ? 'bg-orange-500' :
                        ruleEvaluation.totalScore >= 31 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${ruleEvaluation.totalScore}%` }}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-mono">
                  Prescribed Action: <strong className="text-white">{ruleEvaluation.action}</strong> ({ruleEvaluation.riskBand})
                </p>
              </div>

              {/* ML Tabular Probability (Secondary Signal) */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">ML Fraud Probability</span>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold font-mono text-purple-400">
                    {mlEvaluation.probabilityDisplay || '94%'}
                  </span>
                  <span className="text-xs font-mono text-slate-400">({mlEvaluation.confidenceLevel} Confidence)</span>
                </div>
                <div className="mt-2">
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-500"
                      style={{ width: `${Math.round((mlEvaluation.probability || 0.94) * 100)}%` }}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 font-mono">
                  Model: Random Forest Ensemble v2.4 (Secondary signal)
                </p>
              </div>

            </div>
          </div>

          {/* Customer Behavioral Baseline vs Current Transaction */}
          {(() => {
            const rule1 = ruleEvaluation?.reasons?.find(r => r.category === 'AMOUNT_ANOMALY' || r.ruleId === 'RULE_AMOUNT_ANOMALY');
            const rule2 = ruleEvaluation?.reasons?.find(r => r.category === 'DEVICE_ANOMALY' || r.ruleId === 'RULE_DEVICE_ANOMALY');
            const rule3 = ruleEvaluation?.reasons?.find(r => r.category === 'LOCATION_ANOMALY' || r.ruleId === 'RULE_LOCATION_ANOMALY');
            const rule4 = ruleEvaluation?.reasons?.find(r => r.category === 'TRANSACTION_VELOCITY' || r.ruleId === 'RULE_VELOCITY_ANOMALY');
            const rule6 = ruleEvaluation?.reasons?.find(r => r.category === 'FRAUD_NETWORK' || r.ruleId === 'RULE_FRAUD_NETWORK');

            const isDeviceTrusted = (customer.knownDevices || []).includes(transaction.deviceId) && !rule2?.triggered;
            const isAmountNormal = !rule1?.triggered;
            const isLocationNormal = !rule3?.triggered;
            const isVelocityNormal = !rule4?.triggered;

            return (
              <div className="glass-panel p-5 rounded-2xl border border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-400" />
                  <span>Behavioral Baseline vs Observed Transaction</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  
                  {/* Expected Baseline */}
                  <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                      Customer Baseline Profile
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-500">Average Spend:</span>
                      <span className="text-white font-bold">₹{customer.baselineAmount?.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-500">Home Location:</span>
                      <span className="text-white">{customer.homeLocation}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-500">Trusted Devices:</span>
                      <span className="text-cyan-400 font-bold">[{customer.knownDevices?.join(', ') || 'None'}]</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Historical Risk:</span>
                      <span className="text-emerald-400 font-bold">{customer.riskStatus || 'CLEAN'}</span>
                    </div>
                  </div>

                  {/* Observed Transaction */}
                  <div className={`bg-slate-900/80 p-3.5 rounded-xl border space-y-2 ${
                    ruleEvaluation.totalScore > 30 ? 'border-rose-900/40' : 'border-slate-800'
                  }`}>
                    <div className="text-xs font-bold uppercase tracking-wide flex items-center justify-between">
                      <span className={ruleEvaluation.totalScore > 30 ? 'text-rose-400' : 'text-slate-300'}>
                        Observed Transaction
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        ruleEvaluation.totalScore > 30 ? 'bg-rose-950 text-rose-300 border border-rose-800' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {ruleEvaluation.totalScore} pts
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-500">Attempted Amount:</span>
                      <span className={isAmountNormal ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        ₹{transaction.amount?.toLocaleString('en-IN')} {isAmountNormal ? '(Normal)' : `(${(transaction.amount / (customer.baselineAmount || 1)).toFixed(1)}x)`}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-500">Transaction Origin:</span>
                      <span className={isLocationNormal ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {transaction.location} {isLocationNormal ? '(Matches Home)' : '(Mismatch)'}
                      </span>
                    </div>

                    <div className="flex justify-between border-b border-slate-800/80 pb-1">
                      <span className="text-slate-500">Device Fingerprint:</span>
                      <span className={isDeviceTrusted ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {transaction.deviceId} {isDeviceTrusted ? '(Verified Trusted)' : '(Unrecognized Device)'}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">Velocity Window:</span>
                      <span className={isVelocityNormal ? 'text-slate-300 font-bold' : 'text-rose-400 font-bold'}>
                        {transaction.velocity || 1} txn / 5m {isVelocityNormal ? '(Normal)' : '(High Velocity)'}
                      </span>
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* The 6 Explainable Anomaly Reasons */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>The 6 Explainable Anomaly Reasons</span>
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {ruleEvaluation.reasons.filter(r => r.triggered).length} of 6 Triggered
              </span>
            </div>

            <div className="space-y-3">
              {ruleEvaluation.reasons.map((rule, idx) => (
                <div
                  key={rule.ruleId || idx}
                  className={`p-3.5 rounded-xl border transition-all ${
                    rule.triggered
                      ? 'bg-slate-900 border-rose-900/60 shadow-sm'
                      : 'bg-slate-950/40 border-slate-800/50 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold mt-0.5 ${
                        rule.triggered ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{rule.title}</span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            rule.triggered ? 'badge-crit' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {rule.triggered ? `+${rule.points} pts` : '0 pts (Passed)'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">
                          {rule.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Network Graph Visualizer - Wired Strictly to Rule 6 */}
          {(() => {
            const rule6 = ruleEvaluation?.reasons?.find(r => r.category === 'FRAUD_NETWORK' || r.ruleId === 'RULE_FRAUD_NETWORK');
            const isRule6Active = Boolean(rule6?.triggered);

            return (
              <NetworkGraphViewer
                graphData={networkContext}
                selectedEntityId={transaction.deviceId}
                title={
                  isRule6Active
                    ? "Connected Syndicate Entities Subgraph (Rule 6: +10 pts Triggered)"
                    : "Entity Network Topology (Rule 6 Passed: 0 pts, No Syndicate Links)"
                }
              />
            );
          })()}

        </div>

        {/* Right Column: AI Investigation Copilot + RAG Policy Evidence (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* AI Investigation Copilot Chat & Quick Queries */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col h-[600px]">
            
            {/* Copilot Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/30">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    AI Investigation Copilot
                  </h3>
                  <p className="text-[10px] text-cyan-400 font-mono">
                    RAG Grounded in Bank SOP & Policy
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 rounded">
                Backend Grounded
              </span>
            </div>

            {/* The 4 Standard Investigator Quick Buttons */}
            <div className="space-y-1.5 mb-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                Standard Investigation Queries:
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleQueryCopilot('Why was this transaction flagged?')}
                  disabled={copilotLoading}
                  className="p-2 text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 rounded-xl text-[11px] font-medium text-slate-300 transition-all"
                >
                  1. Why was it flagged?
                </button>
                <button
                  onClick={() => handleQueryCopilot('What are the strongest risk indicators?')}
                  disabled={copilotLoading}
                  className="p-2 text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 rounded-xl text-[11px] font-medium text-slate-300 transition-all"
                >
                  2. Strongest risk indicators?
                </button>
                <button
                  onClick={() => handleQueryCopilot('Summarize this case.')}
                  disabled={copilotLoading}
                  className="p-2 text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 rounded-xl text-[11px] font-medium text-slate-300 transition-all"
                >
                  3. Summarize this case.
                </button>
                <button
                  onClick={() => handleQueryCopilot('What should the investigator review next?')}
                  disabled={copilotLoading}
                  className="p-2 text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 rounded-xl text-[11px] font-medium text-slate-300 transition-all"
                >
                  4. What to review next?
                </button>
              </div>
            </div>

            {/* Chat Response Stream Area */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs font-sans">
              {copilotHistory.map((item, i) => (
                <div key={i} className="space-y-1.5">
                  {/* User Query Pill */}
                  <div className="flex justify-end">
                    <div className="bg-cyan-950/80 border border-cyan-800/80 text-cyan-200 px-3 py-1.5 rounded-xl max-w-[85%] font-medium">
                      {item.query}
                    </div>
                  </div>

                  {/* AI Response Card */}
                  <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-slate-800 pb-1">
                      <span className="text-cyan-400 font-bold">FraudShield Copilot</span>
                      <span>{item.modelUsed || 'Grounded Engine'}</span>
                    </div>

                    {/* Formatted Markdown Content */}
                    <div className="text-slate-200 leading-relaxed space-y-2 whitespace-pre-wrap">
                      {item.answer}
                    </div>

                    {/* Policy Grounding Citations */}
                    {item.groundedInPolicies && item.groundedInPolicies.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] font-mono text-slate-500 block mb-1">Grounded In Policies:</span>
                        <div className="flex flex-wrap gap-1">
                          {item.groundedInPolicies.map((p, pIdx) => (
                            <span key={pIdx} className="px-1.5 py-0.5 text-[9px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800 rounded">
                              [{p.id}] {p.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {copilotLoading && (
                <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span>Consulting RAG policy base and synthesizing evidence...</span>
                </div>
              )}
            </div>

            {/* Custom Query Input Box */}
            <div className="pt-3 border-t border-slate-800 mt-2 flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask custom policy or risk question..."
                value={copilotQuery}
                onChange={(e) => setCopilotQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQueryCopilot();
                }}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
              />
              <button
                onClick={() => handleQueryCopilot()}
                disabled={copilotLoading || !copilotQuery.trim()}
                className="p-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl transition-all disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

          </div>

          {/* RAG Knowledge Grounding Panel */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>RAG Grounded Policy Evidence</span>
              </h3>
              <span className="text-[10px] font-mono text-emerald-400">
                {retrievedPolicies?.length || 0} Retrieved Articles
              </span>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto">
              {(retrievedPolicies || []).map((policy) => (
                <div key={policy.id} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">[{policy.id}] {policy.title}</span>
                    <span className="text-[10px] font-mono text-emerald-400">Score: {policy.relevanceScore || 1.0}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {policy.matchedExcerpt || policy.fullContent?.slice(0, 160) + '...'}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Investigator Resolution Modal */}
      {showResolutionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Record Investigator Resolution
                </h3>
              </div>
              <button
                onClick={() => setShowResolutionModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Select the binding resolution action for transaction <strong>{transaction.transactionId}</strong> (₹{transaction.amount?.toLocaleString('en-IN')}).
            </p>

            {/* Action Select Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setResolutionAction('ALLOW')}
                className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                  resolutionAction === 'ALLOW'
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                ALLOW
                <span className="block text-[9px] font-normal opacity-80">False Positive</span>
              </button>

              <button
                type="button"
                onClick={() => setResolutionAction('VERIFY')}
                className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                  resolutionAction === 'VERIFY'
                    ? 'bg-orange-600 text-white border-orange-400 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                VERIFY
                <span className="block text-[9px] font-normal opacity-80">Step-up MFA</span>
              </button>

              <button
                type="button"
                onClick={() => setResolutionAction('BLOCK')}
                className={`p-3 rounded-xl border text-center font-bold text-xs transition-all ${
                  resolutionAction === 'BLOCK'
                    ? 'bg-rose-600 text-white border-rose-400 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                BLOCK
                <span className="block text-[9px] font-normal opacity-80">Confirmed Fraud</span>
              </button>
            </div>

            {/* Notes textarea */}
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">
                Investigation Audit Notes:
              </label>
              <textarea
                rows={3}
                placeholder="Document rationale, phone verification findings, or device blacklist action..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResolutionModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolveCase}
                disabled={isResolving}
                className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-all"
              >
                {isResolving ? 'Submitting...' : 'Submit Resolution'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
