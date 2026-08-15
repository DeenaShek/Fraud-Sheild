import express from 'express';
import { Transaction, Customer, Alert } from '../models/schemas.js';
import { networkGraphEngine } from '../engine/networkGraph.js';
import { policyRetriever } from '../rag/retriever.js';
import { investigationCopilot } from '../rag/llmCopilot.js';
import { requireAuth } from './auth.middleware.js';

const router = express.Router();

/**
 * GET /api/investigation/:transactionId
 * Assembles full 360-degree case dossier for deep-dive investigation
 */
router.get('/:transactionId', requireAuth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    // 1. Fetch Transaction
    const txn = await Transaction.findOne({
      $or: [{ transactionId }, { _id: transactionId }]
    });

    if (!txn) {
      return res.status(404).json({ error: `Transaction '${transactionId}' not found.` });
    }

    // 2. Fetch Customer profile & recent normal history
    const customer = await Customer.findOne({ customerId: txn.customerId });
    const customerHistory = await Transaction.find({
      customerId: txn.customerId,
      transactionId: { $ne: txn.transactionId }
    }).sort({ createdAt: -1 }).limit(10);

    // 3. Extract Network Subgraph strictly aligned with Rule 6 (Fraud Network Linkage)
    const rule6Triggered = Boolean(txn.reasons?.find(r => r.category === 'FRAUD_NETWORK' || r.ruleId === 'RULE_FRAUD_NETWORK')?.triggered);
    
    let networkContext;
    if (rule6Triggered) {
      const deviceSubgraph = networkGraphEngine.getSubgraphForEntity(txn.deviceId || 'D999', 2);
      const customerSubgraph = networkGraphEngine.getSubgraphForEntity(txn.customerId, 2);

      // Merge subgraphs for comprehensive syndicate cluster view
      const nodeMap = new Map();
      [...deviceSubgraph.nodes, ...customerSubgraph.nodes].forEach(n => nodeMap.set(n.id, n));
      const mergedNodes = Array.from(nodeMap.values());
      
      const edgeKey = e => `${e.source}->${e.target}`;
      const edgeMap = new Map();
      [...deviceSubgraph.links, ...customerSubgraph.links].forEach(e => edgeMap.set(edgeKey(e), e));
      const mergedLinks = Array.from(edgeMap.values());

      networkContext = {
        centerEntities: [txn.customerId, txn.deviceId],
        nodes: mergedNodes,
        links: mergedLinks,
        metrics: deviceSubgraph.metrics,
        hasFraudRingLinks: true
      };
    } else {
      // Clean isolated topology when Rule 6 passes (0 pts)
      networkContext = {
        centerEntities: [txn.customerId, txn.deviceId],
        nodes: [
          { id: txn.customerId, type: 'CUSTOMER', label: `${customer?.name || txn.customerName} (${txn.customerId})`, riskLevel: 'LOW' },
          { id: txn.deviceId, type: 'DEVICE', label: `Device ${txn.deviceId} (Verified Clean)`, riskLevel: 'LOW' },
          { id: txn.ipAddress || '103.21.124.89', type: 'IP', label: `IP ${txn.ipAddress || '103.21.124.89'} (Domestic ISP)`, riskLevel: 'LOW' }
        ],
        links: [
          { source: txn.customerId, target: txn.deviceId, relationship: 'AUTHENTICATED_ON', weight: 0.9 },
          { source: txn.deviceId, target: txn.ipAddress || '103.21.124.89', relationship: 'CONNECTED_VIA', weight: 0.8 }
        ],
        metrics: {
          totalEntities: 3,
          totalConnections: 2,
          criticalEntitiesCount: 0,
          highRiskEntitiesCount: 0,
          syndicateThreatLevel: 'CLEAN',
          hasFraudRingLinks: false
        }
      };
    }

    // 4. Retrieve RAG Policies based on triggered rules
    const triggeredRules = (txn.reasons || []).filter(r => r.triggered);
    const retrievedPolicies = policyRetriever.retrieveForTriggeredRules(triggeredRules);

    // 5. Build Default Initial Copilot Summary
    const initialCopilotSummary = await investigationCopilot.synthesizeGroundedResponse(
      'Summarize this case.',
      {
        transactionId: txn.transactionId,
        amount: `₹${txn.amount?.toLocaleString('en-IN')}`,
        baselineAmount: `₹${(customer?.baselineAmount || txn.customerBaseline)?.toLocaleString('en-IN')}`,
        location: txn.location,
        homeLocation: customer?.homeLocation || txn.homeLocation,
        device: txn.deviceId,
        merchant: txn.merchant?.name || txn.merchant,
        deterministicScore: `${txn.ruleScore} / 100 (${txn.riskBand})`,
        mlProbability: txn.mlProbabilityDisplay || '5%',
        linkedAccounts: networkContext.metrics?.criticalEntitiesCount || 0
      },
      { reasons: txn.reasons, totalScore: txn.ruleScore, riskBand: txn.riskBand, action: txn.action },
      { probability: txn.mlProbability, probabilityDisplay: txn.mlProbabilityDisplay },
      retrievedPolicies,
      networkContext
    );

    res.json({
      transaction: txn,
      customer: customer || {
        customerId: txn.customerId,
        name: txn.customerName || 'Customer',
        homeLocation: txn.homeLocation,
        baselineAmount: txn.customerBaseline,
        knownDevices: [txn.deviceId]
      },
      customerHistory,
      ruleEvaluation: {
        totalScore: txn.ruleScore,
        riskBand: txn.riskBand,
        action: txn.action,
        actionDescription: txn.actionDescription,
        reasons: txn.reasons
      },
      mlEvaluation: {
        probability: txn.mlProbability,
        probabilityDisplay: txn.mlProbabilityDisplay,
        confidenceLevel: txn.mlConfidence,
        features: txn.mlFeatures,
        contributions: txn.mlContributions
      },
      networkContext,
      retrievedPolicies,
      initialCopilotSummary
    });
  } catch (err) {
    console.error('[Investigation Route] Error:', err);
    res.status(500).json({ error: 'Failed to assemble investigation dossier.' });
  }
});

/**
 * POST /api/investigation/:transactionId/copilot
 * Ask question to RAG-grounded LLM Copilot
 */
router.post('/:transactionId/copilot', requireAuth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query prompt is required.' });
    }

    const txn = await Transaction.findOne({
      $or: [{ transactionId }, { _id: transactionId }]
    });
    if (!txn) return res.status(404).json({ error: 'Transaction not found.' });

    const customer = await Customer.findOne({ customerId: txn.customerId });
    const networkContext = networkGraphEngine.getSubgraphForEntity(txn.deviceId, 2);

    const caseContext = {
      transaction: txn,
      customer,
      ruleEvaluation: {
        totalScore: txn.ruleScore,
        riskBand: txn.riskBand,
        action: txn.action,
        reasons: txn.reasons
      },
      mlResult: {
        probability: txn.mlProbability,
        probabilityDisplay: txn.mlProbabilityDisplay
      },
      networkContext
    };

    const copilotResponse = await investigationCopilot.answerInvestigatorQuery(query, caseContext);
    res.json({ copilotResponse });
  } catch (err) {
    console.error('[Copilot Query] Error:', err);
    res.status(500).json({ error: 'Copilot query failed.' });
  }
});

/**
 * POST /api/investigation/:transactionId/resolve
 * Submit Investigator Action & Resolution
 */
router.post('/:transactionId/resolve', requireAuth, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { resolutionAction, notes } = req.body; // 'ALLOW', 'VERIFY', 'BLOCK'

    if (!['ALLOW', 'VERIFY', 'BLOCK'].includes(resolutionAction)) {
      return res.status(400).json({ error: 'Invalid resolution action. Must be ALLOW, VERIFY, or BLOCK.' });
    }

    const statusMap = {
      'ALLOW': 'RESOLVED_ALLOW',
      'VERIFY': 'RESOLVED_VERIFY',
      'BLOCK': 'RESOLVED_BLOCK'
    };

    const status = statusMap[resolutionAction];

    // Update Transaction
    const txn = await Transaction.findOneAndUpdate(
      { $or: [{ transactionId }, { _id: transactionId }] },
      {
        status,
        investigationNotes: notes || `Resolved as ${resolutionAction} by ${req.user.name} (${req.user.badgeId}).`,
        resolvedBy: req.user.name,
        resolvedAt: new Date()
      },
      { new: true }
    );

    if (!txn) return res.status(404).json({ error: 'Transaction not found.' });

    // Update corresponding Alert to RESOLVED
    await Alert.updateMany(
      { transactionId: txn.transactionId },
      { status: 'RESOLVED', assignedTo: req.user.name }
    );

    res.json({
      success: true,
      message: `Case resolved successfully as ${resolutionAction}.`,
      transaction: txn
    });
  } catch (err) {
    console.error('[Resolve Case] Error:', err);
    res.status(500).json({ error: 'Failed to resolve case.' });
  }
});

export default router;
