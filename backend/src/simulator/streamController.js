import { transactionGenerator } from './transactionGenerator.js';
import { evaluateTransactionRules } from '../engine/ruleEngine.js';
import { fraudMLModel } from '../engine/mlModel.js';
import { networkGraphEngine } from '../engine/networkGraph.js';
import { Customer, Transaction, Alert, EngineConfig } from '../models/schemas.js';

export class StreamController {
  constructor() {
    this.io = null;
    this.timer = null;
    this.isRunning = false;
    this.intervalMs = 3000; // Default: 1 transaction every 3 seconds
    this.totalEmitted = 0;
    this.totalAlerts = 0;
  }

  setSocketIO(io) {
    this.io = io;
  }

  async getEngineConfig() {
    const configDoc = await EngineConfig.findOne({ configKey: 'GLOBAL_RULE_CONFIG' });
    return configDoc ? configDoc.toObject() : undefined;
  }

  /**
   * Processes a single transaction through the full end-to-end intelligence pipeline:
   * Rule Engine -> Tabular ML Model -> Network Graph -> MongoDB -> Socket.IO broadcast
   */
  async processAndBroadcastTransaction(rawTxn) {
    // 1. Fetch customer context
    const customer = await Customer.findOne({ customerId: rawTxn.customerId });
    const config = await this.getEngineConfig();

    // 2. Prepare context for scoring
    const context = {
      knownDevices: customer?.knownDevices || [rawTxn.deviceId],
      recentTxnCount5m: rawTxn.velocity || 1,
      hasFraudRingLinks: rawTxn.networkRiskSignal,
      linkedSuspiciousAccountsCount: rawTxn.networkRiskSignal ? 3 : 0
    };

    // 3. Evaluate Core Deterministic 6-Rule Engine
    const ruleEvaluation = evaluateTransactionRules(rawTxn, customer, context, config);

    // 4. Evaluate Tabular ML Fraud Probability
    const mlEvaluation = fraudMLModel.evaluate(rawTxn, customer, context);

    // 5. Ingest into Network Graph
    networkGraphEngine.ingestTransaction({
      ...rawTxn,
      riskBand: ruleEvaluation.riskBand,
      isHighRiskMerchant: rawTxn.isHighRiskMerchant
    }, customer);

    // 6. Persist Transaction to Database
    const amountRatio = customer?.baselineAmount ? Number((rawTxn.amount / customer.baselineAmount).toFixed(2)) : 1.0;
    
    const txnDoc = new Transaction({
      transactionId: rawTxn.transactionId,
      customerId: rawTxn.customerId,
      customerName: rawTxn.customerName || customer?.name || 'Customer',
      amount: rawTxn.amount,
      currency: rawTxn.currency || 'INR',
      customerBaseline: customer?.baselineAmount || rawTxn.customerBaseline || 3200,
      amountRatio,
      deviceId: rawTxn.deviceId,
      deviceOs: rawTxn.deviceOs || 'Mobile/Web',
      isNewDevice: !(customer?.knownDevices || []).includes(rawTxn.deviceId),
      location: rawTxn.location,
      homeLocation: customer?.homeLocation || rawTxn.homeLocation || 'Chennai, India',
      isLocationAnomalous: rawTxn.isLocationAnomalous,
      ipAddress: rawTxn.ipAddress || '192.168.1.1',
      merchant: rawTxn.merchant,
      isNewMerchant: rawTxn.isNewMerchant,
      velocity: rawTxn.velocity || 1,
      networkRiskSignal: rawTxn.networkRiskSignal,
      cardLast4: rawTxn.cardLast4 || '4412',
      cardType: rawTxn.cardType || 'Visa Platinum',
      
      // Deterministic scoring engine output
      ruleScore: ruleEvaluation.totalScore,
      riskBand: ruleEvaluation.riskBand,
      action: ruleEvaluation.action,
      actionDescription: ruleEvaluation.actionDescription,
      reasons: ruleEvaluation.reasons,
      
      // ML secondary output
      mlProbability: mlEvaluation.probability,
      mlProbabilityDisplay: mlEvaluation.probabilityDisplay,
      mlConfidence: mlEvaluation.confidenceLevel,
      mlFeatures: mlEvaluation.features,
      mlContributions: mlEvaluation.contributions,
      
      status: ruleEvaluation.riskBand === 'CRITICAL' ? 'INVESTIGATING' : 'PROCESSED',
      isWorkedExample: Boolean(rawTxn.isWorkedExample)
    });

    await txnDoc.save();
    this.totalEmitted++;

    let createdAlert = null;

    // 7. Generate Alert if Medium, High, or Critical
    if (ruleEvaluation.riskBand !== 'LOW') {
      const topReasons = ruleEvaluation.reasons
        .filter(r => r.triggered)
        .map(r => `${r.title} (+${r.points} pts)`);

      const alertDoc = new Alert({
        alertId: `ALT-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
        transactionId: txnDoc.transactionId,
        customerId: txnDoc.customerId,
        customerName: txnDoc.customerName,
        amount: txnDoc.amount,
        currency: txnDoc.currency,
        riskScore: txnDoc.ruleScore,
        riskBand: txnDoc.riskBand,
        actionRequired: txnDoc.action,
        topReasons,
        mlProbability: txnDoc.mlProbabilityDisplay,
        status: 'OPEN'
      });

      await alertDoc.save();
      createdAlert = alertDoc.toObject();
      this.totalAlerts++;
    }

    // 8. Broadcast over Socket.IO
    if (this.io) {
      this.io.emit('new_transaction', txnDoc.toObject());
      if (createdAlert) {
        this.io.emit('new_alert', createdAlert);
      }
    }

    return {
      transaction: txnDoc.toObject(),
      alert: createdAlert,
      ruleEvaluation,
      mlEvaluation
    };
  }

  /**
   * Generates a step tick in continuous streaming mode.
   */
  async tick() {
    try {
      const customers = await Customer.find().limit(10);
      const rawTxn = transactionGenerator.generateRandomTransaction(customers);
      await this.processAndBroadcastTransaction(rawTxn);
    } catch (err) {
      console.error('[Stream Controller] Tick error:', err);
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[Stream Controller] Simulator started (Interval: ${this.intervalMs}ms)`);
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    if (this.io) this.io.emit('simulator_status', this.getStatus());
  }

  stop() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log(`[Stream Controller] Simulator paused.`);
    if (this.io) this.io.emit('simulator_status', this.getStatus());
  }

  setSpeed(intervalMs) {
    this.intervalMs = Math.max(500, Math.min(10000, Number(intervalMs) || 3000));
    if (this.isRunning) {
      this.stop();
      this.start();
    }
    if (this.io) this.io.emit('simulator_status', this.getStatus());
  }

  /**
   * Directly triggers the Worked Example (100 pts - All 6 Rules Fired, Dubai Syndicate Attack)
   */
  async injectWorkedExample() {
    console.log('[Stream Controller] INJECTING WORKED EXAMPLE BENCHMARK SCENARIO (100 pts)...');
    const rawTxn = transactionGenerator.generateWorkedExampleTransaction();
    return await this.processAndBroadcastTransaction(rawTxn);
  }

  /**
   * Directly triggers the clean Single-Rule Merchant Anomaly scenario (+10 pts, LOW / ALLOW)
   */
  async injectMerchantAnomaly() {
    console.log('[Stream Controller] INJECTING MERCHANT ANOMALY SCENARIO (+10 pts)...');
    const rawTxn = transactionGenerator.generateMerchantAnomalyOnlyTransaction();
    return await this.processAndBroadcastTransaction(rawTxn);
  }

  /**
   * Directly triggers the New Device Only scenario (+20 pts, LOW / ALLOW)
   */
  async injectDeviceAnomaly() {
    console.log('[Stream Controller] INJECTING DEVICE ANOMALY SCENARIO (+20 pts)...');
    const rawTxn = transactionGenerator.generateDeviceAnomalyOnlyTransaction();
    return await this.processAndBroadcastTransaction(rawTxn);
  }

  /**
   * Directly triggers the Travel Anomaly scenario (+40 pts, MEDIUM / MONITOR)
   */
  async injectTravelAnomaly() {
    console.log('[Stream Controller] INJECTING TRAVEL ANOMALY SCENARIO (+40 pts)...');
    const rawTxn = transactionGenerator.generateTravelAnomalyTransaction();
    return await this.processAndBroadcastTransaction(rawTxn);
  }

  /**
   * Injects a rapid burst attack wave (3 high risk transactions).
   */
  async injectAttackWave() {
    console.log('[Stream Controller] Injecting Attack Wave simulation...');
    const customers = await Customer.find().limit(5);
    const results = [];
    for (let i = 0; i < 3; i++) {
      const rawTxn = transactionGenerator.generateRandomTransaction(customers);
      rawTxn.amount = 75000 + i * 12000;
      rawTxn.deviceId = `D-ROGUE-WAVE-${i + 1}`;
      rawTxn.location = 'Dubai, UAE';
      rawTxn.isLocationAnomalous = true;
      rawTxn.velocity = 4 + i;
      rawTxn.networkRiskSignal = true;
      const res = await this.processAndBroadcastTransaction(rawTxn);
      results.push(res);
    }
    return results;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      totalEmitted: this.totalEmitted,
      totalAlerts: this.totalAlerts
    };
  }
}

export const streamController = new StreamController();
