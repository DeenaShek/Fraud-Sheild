import express from 'express';
import { Alert, Transaction } from '../models/schemas.js';
import { requireAuth } from './auth.middleware.js';

const router = express.Router();

/**
 * GET /api/alerts
 * Retrieve live alerts with filtering
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, riskBand, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'ALL') filter.status = status;
    if (riskBand && riskBand !== 'ALL') filter.riskBand = riskBand;

    const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts.' });
  }
});

/**
 * PATCH /api/alerts/:id/status
 */
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const alert = await Alert.findOneAndUpdate(
      { $or: [{ alertId: req.params.id }, { _id: req.params.id }] },
      { status, assignedTo: req.user.name },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found.' });
    res.json({ alert });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update alert.' });
  }
});

export default router;
