import express from 'express';
import { Transaction, Customer, Alert } from '../models/schemas.js';
import { streamController } from '../simulator/streamController.js';
import { requireAuth } from './auth.middleware.js';

const router = express.Router();

/**
 * GET /api/transactions
 * Fetch recent transactions with filtering & pagination
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { riskBand, customerId, status, limit = 50, page = 1 } = req.query;
    const filter = {};

    if (riskBand && riskBand !== 'ALL') filter.riskBand = riskBand;
    if (customerId) filter.customerId = customerId;
    if (status && status !== 'ALL') filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Transaction.countDocuments(filter)
    ]);

    res.json({
      transactions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    console.error('[Transactions Route] Error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

/**
 * GET /api/transactions/stats/overview
 * Real-time statistics, risk band distribution, velocity trends
 */
router.get('/stats/overview', requireAuth, async (req, res) => {
  try {
    const [
      totalCount,
      lowCount,
      mediumCount,
      highCount,
      criticalCount,
      openAlertsCount,
      recentTxns
    ] = await Promise.all([
      Transaction.countDocuments(),
      Transaction.countDocuments({ riskBand: 'LOW' }),
      Transaction.countDocuments({ riskBand: 'MEDIUM' }),
      Transaction.countDocuments({ riskBand: 'HIGH' }),
      Transaction.countDocuments({ riskBand: 'CRITICAL' }),
      Alert.countDocuments({ status: 'OPEN' }),
      Transaction.find().sort({ createdAt: -1 }).limit(30)
    ]);

    // Calculate total amount processed & blocked fraud amount
    const blockedTxns = await Transaction.find({ riskBand: 'CRITICAL' });
    const blockedFraudLossPrevented = blockedTxns.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const allTxns = await Transaction.find().select('amount');
    const totalVolume = allTxns.reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // Distribution
    const distribution = [
      { name: 'Low (0-30)', count: lowCount, fill: '#10b981', action: 'ALLOW' },
      { name: 'Medium (31-60)', count: mediumCount, fill: '#f59e0b', action: 'MONITOR' },
      { name: 'High (61-80)', count: highCount, fill: '#f97316', action: 'VERIFY' },
      { name: 'Critical (81-100)', count: criticalCount, fill: '#ef4444', action: 'BLOCK' }
    ];

    res.json({
      metrics: {
        totalTransactions: totalCount,
        openAlerts: openAlertsCount,
        blockedFraudLossPrevented,
        totalVolumeProcessed: totalVolume,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        fraudCatchRate: totalCount > 0 ? Number(((criticalCount + highCount) / totalCount * 100).toFixed(1)) : 0
      },
      distribution,
      recentTransactions: recentTxns
    });
  } catch (err) {
    console.error('[Stats Route] Error:', err);
    res.status(500).json({ error: 'Failed to aggregate statistics.' });
  }
});

/**
 * GET /api/transactions/customers
 * List customers for profile inspector
 */
router.get('/customers', requireAuth, async (req, res) => {
  try {
    const customers = await Customer.find().sort({ name: 1 });
    res.json({ customers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customers.' });
  }
});

/**
 * GET /api/transactions/customers/:customerId
 * Customer details and historical transactions
 */
router.get('/customers/:customerId', requireAuth, async (req, res) => {
  try {
    const customer = await Customer.findOne({ customerId: req.params.customerId });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    const history = await Transaction.find({ customerId: req.params.customerId }).sort({ createdAt: -1 }).limit(20);
    res.json({ customer, history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer profile.' });
  }
});

/**
 * GET /api/transactions/:id
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const txn = await Transaction.findOne({
      $or: [{ transactionId: req.params.id }, { _id: req.params.id }]
    });
    if (!txn) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }
    res.json({ transaction: txn });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transaction.' });
  }
});

// ==================== SIMULATOR CONTROLS ====================

router.get('/simulator/status', requireAuth, (req, res) => {
  res.json(streamController.getStatus());
});

router.post('/simulator/start', requireAuth, (req, res) => {
  streamController.start();
  res.json({ success: true, status: streamController.getStatus() });
});

router.post('/simulator/stop', requireAuth, (req, res) => {
  streamController.stop();
  res.json({ success: true, status: streamController.getStatus() });
});

router.post('/simulator/speed', requireAuth, (req, res) => {
  const { intervalMs } = req.body;
  streamController.setSpeed(intervalMs);
  res.json({ success: true, status: streamController.getStatus() });
});

router.post('/simulator/inject-worked-example', requireAuth, async (req, res) => {
  try {
    const result = await streamController.injectWorkedExample();
    res.json({ success: true, result });
  } catch (err) {
    console.error('[Inject Worked Example] Error:', err);
    res.status(500).json({ error: 'Failed to inject worked example.' });
  }
});

router.post('/simulator/inject-merchant-anomaly', requireAuth, async (req, res) => {
  try {
    const result = await streamController.injectMerchantAnomaly();
    res.json({ success: true, result });
  } catch (err) {
    console.error('[Inject Merchant Anomaly] Error:', err);
    res.status(500).json({ error: 'Failed to inject merchant anomaly.' });
  }
});

router.post('/simulator/inject-device-anomaly', requireAuth, async (req, res) => {
  try {
    const result = await streamController.injectDeviceAnomaly();
    res.json({ success: true, result });
  } catch (err) {
    console.error('[Inject Device Anomaly] Error:', err);
    res.status(500).json({ error: 'Failed to inject device anomaly.' });
  }
});

router.post('/simulator/inject-travel-anomaly', requireAuth, async (req, res) => {
  try {
    const result = await streamController.injectTravelAnomaly();
    res.json({ success: true, result });
  } catch (err) {
    console.error('[Inject Travel Anomaly] Error:', err);
    res.status(500).json({ error: 'Failed to inject travel anomaly.' });
  }
});

router.post('/simulator/inject-attack-wave', requireAuth, async (req, res) => {
  try {
    const results = await streamController.injectAttackWave();
    res.json({ success: true, count: results.length, results });
  } catch (err) {
    console.error('[Inject Attack Wave] Error:', err);
    res.status(500).json({ error: 'Failed to inject attack wave.' });
  }
});

router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', status: streamController.getStatus() })}\n\n`);
  const onTxn = (txn) => res.write(`event: TRANSACTION\ndata: ${JSON.stringify(txn)}\n\n`);
  const onAlert = (alt) => res.write(`event: ALERT\ndata: ${JSON.stringify(alt)}\n\n`);
  const onStatus = (st) => res.write(`event: SIMULATOR_STATUS\ndata: ${JSON.stringify(st)}\n\n`);

  streamController.on('transaction', onTxn);
  streamController.on('alert', onAlert);
  streamController.on('status', onStatus);

  req.on('close', () => {
    streamController.off('transaction', onTxn);
    streamController.off('alert', onAlert);
    streamController.off('status', onStatus);
  });
});

export default router;
