import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { User, Customer, Transaction, Alert, EngineConfig } from '../models/schemas.js';
import { DEFAULT_RULE_CONFIG, evaluateTransactionRules } from '../engine/ruleEngine.js';
import { fraudMLModel } from '../engine/mlModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedInitialData() {
  console.log('[Seeder] Checking and initializing seed data with FraudShield v2 Dataset...');

  // 1. Seed Users (Admin & Analyst)
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const analystPassword = await bcrypt.hash('analyst123', 10);

    await User.create([
      {
        username: 'admin',
        email: 'admin@fraudshield.bank',
        password: adminPassword,
        role: 'ADMIN',
        name: 'Victoria Vance',
        badgeId: 'SEC-DIR-01',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
      },
      {
        username: 'analyst',
        email: 'analyst@fraudshield.bank',
        password: analystPassword,
        role: 'ANALYST',
        name: 'Arjun Mehta',
        badgeId: 'FRD-INV-88',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
      }
    ]);
    console.log('[Seeder] Created default Admin and Analyst accounts.');
  }

  // 2. Seed Engine Config
  const configExists = await EngineConfig.findOne({ configKey: 'GLOBAL_RULE_CONFIG' });
  if (!configExists) {
    await EngineConfig.create({
      configKey: 'GLOBAL_RULE_CONFIG',
      rules: DEFAULT_RULE_CONFIG.rules,
      thresholds: DEFAULT_RULE_CONFIG.thresholds,
      updatedBy: 'System Bootstrap'
    });
    console.log('[Seeder] Created default Engine Rule Configuration.');
  }

  // Load Dataset Sample v2 (2,000 transaction sample from 105,607 PaySim-enriched dataset)
  let datasetSample = [];
  try {
    const datasetPath = path.join(__dirname, 'datasets', 'fraudshield_seed_sample_v2.json');
    if (fs.existsSync(datasetPath)) {
      datasetSample = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
      console.log(`[Seeder] Loaded ${datasetSample.length} records from fraudshield_seed_sample_v2.json`);
    }
  } catch (err) {
    console.error('[Seeder] Failed to load dataset sample file:', err);
  }

  // 3. Seed Benchmark Customers & Dataset Customers
  const customerCount = await Customer.countDocuments();
  if (customerCount === 0) {
    const baseCustomers = [
      {
        customerId: 'CUST-8021',
        name: 'Ramesh Kumar',
        email: 'ramesh.kumar@acme-corp.in',
        phone: '+91 98401 23891',
        homeLocation: 'Chennai, India',
        baselineAmount: 3200,
        knownDevices: ['D101', 'D102'],
        frequentMerchants: ['Swiggy', 'Amazon IN', 'Apollo Pharmacy', 'Indian Oil', 'Flipkart'],
        riskStatus: 'CLEAN',
        totalTransactionsCount: 142,
        averageDailySpend: 3200
      },
      {
        customerId: 'CUST-1044',
        name: 'Tariq Al-Mansoor',
        email: 'tariq.mansoor@gulf-trading.ae',
        phone: '+971 50 123 4567',
        homeLocation: 'Dubai, UAE',
        baselineAmount: 18500,
        knownDevices: ['D999', 'D404'],
        frequentMerchants: ['Emirates Gold & Luxury Watch Exchange', 'Dubai Duty Free', 'Careem'],
        riskStatus: 'FLAGGED',
        totalTransactionsCount: 28,
        averageDailySpend: 18500
      },
      {
        customerId: 'CUST-3310',
        name: 'Ananya Deshmukh',
        email: 'ananya.d@mumbai-tech.io',
        phone: '+91 98200 44192',
        homeLocation: 'Mumbai, India',
        baselineAmount: 4800,
        knownDevices: ['D301'],
        frequentMerchants: ['Zomato', 'Uber India', 'Reliance Digital', 'Tata Neu'],
        riskStatus: 'CLEAN',
        totalTransactionsCount: 89,
        averageDailySpend: 4800
      },
      {
        customerId: 'CUST-9012',
        name: 'Elena Rostova',
        email: 'elena.rostova@offshore-holdings.ch',
        phone: '+41 79 555 1290',
        homeLocation: 'Zurich, Switzerland',
        baselineAmount: 45000,
        knownDevices: ['D999'],
        frequentMerchants: ['Crypto Sovereign Exchange', 'Geneva Luxury Vault'],
        riskStatus: 'BLOCKED',
        totalTransactionsCount: 12,
        averageDailySpend: 45000
      }
    ];

    // Extract unique customers from dataset sample
    const seenCustIds = new Set(baseCustomers.map(c => c.customerId));
    for (const raw of datasetSample.slice(0, 50)) {
      if (!seenCustIds.has(raw.customerId)) {
        seenCustIds.add(raw.customerId);
        const trustedDev = raw.deviceId.includes('NEW') ? raw.deviceId.replace('NEW-', '') : raw.deviceId;
        baseCustomers.push({
          customerId: raw.customerId,
          name: `Customer ${raw.customerId.slice(0, 6)}`,
          email: `${raw.customerId.toLowerCase()}@${raw.emailDomain || 'bankmail.in'}`,
          phone: `+91 9${Math.floor(100000000 + Math.random() * 900000000)}`,
          homeLocation: raw.distanceFromHomeKm > 0 ? 'Chennai, India' : (raw.location || 'Mumbai, India'),
          baselineAmount: raw.isFullAccountDrain ? Math.round(raw.amount / 10) : (raw.customerBaselineAmount || Math.round(raw.amount)),
          knownDevices: [trustedDev],
          frequentMerchants: [raw.merchantCategory || 'Groceries', 'Food Delivery'],
          riskStatus: 'CLEAN',
          totalTransactionsCount: raw.txnCountLast24h || 1,
          averageDailySpend: Math.round(raw.amount)
        });
      }
    }

    await Customer.create(baseCustomers);
    console.log(`[Seeder] Seeded ${baseCustomers.length} benchmark & dataset customer profiles.`);
  }

  // 4. Seed initial historical transactions directly from FraudShield v2 Dataset
  const txnCount = await Transaction.countDocuments();
  if (txnCount === 0) {
    const historicalTxns = [];
    const alertsToCreate = [];

    // Always include the benchmark Worked Example at the top
    const workedExampleCustomer = await Customer.findOne({ customerId: 'CUST-8021' });
    const workedExample = {
      transactionId: 'TX-WORKED-5001',
      customerId: 'CUST-8021',
      customerName: 'Ramesh Kumar',
      amount: 85000,
      currency: 'INR',
      customerBaseline: 3200,
      amountRatio: 26.56,
      deviceId: 'D999',
      deviceOs: 'iOS 18.2 (iPhone 16 Pro Max)',
      isNewDevice: true,
      location: 'Dubai, UAE',
      homeLocation: 'Chennai, India',
      isLocationAnomalous: true,
      ipAddress: '185.220.101.44',
      merchant: { name: 'Emirates Gold & Luxury Watch Exchange', category: 'Foreign Luxury Exchange', id: 'M_EMIRATES_LUX' },
      isNewMerchant: true,
      velocity: 4,
      networkRiskSignal: true,
      cardLast4: '4412',
      cardType: 'Visa Platinum',
      ruleScore: 100,
      riskBand: 'CRITICAL',
      action: 'BLOCK',
      actionDescription: 'Critical risk threshold exceeded. Payment blocked instantly and forwarded to Fraud Operations.',
      reasons: [
        { ruleId: 'RULE_AMOUNT_ANOMALY', category: 'AMOUNT_ANOMALY', title: 'Amount Anomaly', triggered: true, points: 20, maxPoints: 20, explanation: 'Amount ₹85,000 is 26.6x baseline.' },
        { ruleId: 'RULE_DEVICE_ANOMALY', category: 'DEVICE_ANOMALY', title: 'Device Anomaly', triggered: true, points: 20, maxPoints: 20, explanation: 'Unrecognized rogue device D999.' },
        { ruleId: 'RULE_LOCATION_ANOMALY', category: 'LOCATION_ANOMALY', title: 'Location Anomaly', triggered: true, points: 20, maxPoints: 20, explanation: 'Originated from Dubai, UAE.' },
        { ruleId: 'RULE_VELOCITY_ANOMALY', category: 'TRANSACTION_VELOCITY', title: 'Transaction Velocity', triggered: true, points: 20, maxPoints: 20, explanation: '4 transactions attempted in 5 minutes.' },
        { ruleId: 'RULE_MERCHANT_ANOMALY', category: 'MERCHANT_ANOMALY', title: 'Merchant Anomaly', triggered: true, points: 10, maxPoints: 10, explanation: 'High-risk Foreign Luxury Exchange.' },
        { ruleId: 'RULE_FRAUD_NETWORK', category: 'FRAUD_NETWORK', title: 'Fraud Network Linkage', triggered: true, points: 10, maxPoints: 10, explanation: 'Device D999 linked to active syndicate.' }
      ],
      mlProbability: 0.98,
      mlProbabilityDisplay: '98%',
      mlConfidence: 'CRITICAL',
      status: 'INVESTIGATING',
      isWorkedExample: true,
      createdAt: new Date(Date.now() - 3600000 * 1)
    };
    historicalTxns.push(workedExample);
    alertsToCreate.push({
      alertId: 'ALT-1001-WORKED',
      transactionId: workedExample.transactionId,
      customerId: workedExample.customerId,
      customerName: workedExample.customerName,
      amount: workedExample.amount,
      currency: workedExample.currency,
      riskScore: workedExample.ruleScore,
      riskBand: workedExample.riskBand,
      actionRequired: workedExample.action,
      topReasons: ['Amount Anomaly (+20 pts)', 'Device Anomaly (+20 pts)', 'Location Anomaly (+20 pts)', 'Velocity (+20 pts)', 'Merchant (+10 pts)', 'Fraud Network (+10 pts)'],
      mlProbability: '98%',
      status: 'OPEN'
    });

    // Ingest first 60 transactions from the dataset sample
    const sampleBatch = datasetSample.slice(0, 60);
    for (let i = 0; i < sampleBatch.length; i++) {
      const raw = sampleBatch[i];
      const trustedDevice = raw.deviceId.includes('NEW') ? raw.deviceId.replace('NEW-', '') : raw.deviceId;

      const customer = {
        customerId: raw.customerId,
        name: `Customer ${raw.customerId.slice(0, 6)}`,
        homeLocation: raw.distanceFromHomeKm > 0 ? 'Chennai, India' : (raw.location || 'Mumbai, India'),
        baselineAmount: raw.isFullAccountDrain ? Math.round(raw.amount / 10) : (raw.customerBaselineAmount || Math.round(raw.amount)),
        knownDevices: [trustedDevice],
        frequentMerchants: [raw.merchantCategory || 'Groceries']
      };

      const rawTxn = {
        transactionId: `TX-DATA-${raw.customerId}-${raw.step || (i + 1)}`,
        customerId: raw.customerId,
        amount: Math.round(raw.amount),
        customerBaseline: customer.baselineAmount,
        deviceId: raw.deviceId,
        location: raw.location || 'Mumbai, India',
        homeLocation: customer.homeLocation,
        isLocationAnomalous: Boolean(raw.distanceFromHomeKm > 0),
        merchant: { id: raw.merchantId, name: raw.merchantCategory || 'Retail', category: raw.merchantCategory || 'General Retail' },
        isNewMerchant: Boolean(raw.isNewMerchantForCustomer),
        velocity: raw.txnCountLast24h || 1,
        networkRiskSignal: Boolean(raw.linkedToFraudNetwork),
        isHighRiskMerchant: raw.merchantCategory === 'Crypto Exchange' || raw.merchantCategory === 'Foreign Luxury Exchange'
      };

      const context = {
        knownDevices: customer.knownDevices,
        recentTxnCount5m: rawTxn.velocity,
        hasFraudRingLinks: rawTxn.networkRiskSignal,
        linkedSuspiciousAccountsCount: rawTxn.networkRiskSignal ? 3 : 0
      };

      const ruleEvaluation = evaluateTransactionRules(rawTxn, customer, context);
      const mlEvaluation = fraudMLModel.evaluate(rawTxn, customer, context);
      const isNewDev = ruleEvaluation.reasons.some(r => r.category === 'DEVICE_ANOMALY' && r.triggered);

      const txnDoc = {
        transactionId: rawTxn.transactionId,
        customerId: rawTxn.customerId,
        customerName: customer.name,
        amount: rawTxn.amount,
        currency: 'INR',
        customerBaseline: customer.baselineAmount,
        amountRatio: Number((rawTxn.amount / (customer.baselineAmount || 1)).toFixed(2)),
        deviceId: rawTxn.deviceId,
        deviceOs: rawTxn.deviceId.startsWith('DEV-1') ? 'iOS 18.1' : 'Android 15',
        isNewDevice: isNewDev,
        location: rawTxn.location,
        homeLocation: customer.homeLocation,
        isLocationAnomalous: rawTxn.isLocationAnomalous,
        ipAddress: `103.21.${(i * 7) % 200}.${(i * 13) % 250}`,
        merchant: rawTxn.merchant,
        isNewMerchant: rawTxn.isNewMerchant,
        velocity: rawTxn.velocity,
        networkRiskSignal: rawTxn.networkRiskSignal,
        cardLast4: raw.customerId.slice(-4),
        cardType: `${raw.issuerBank || 'HDFC'} Visa`,
        ruleScore: ruleEvaluation.totalScore,
        riskBand: ruleEvaluation.riskBand,
        action: ruleEvaluation.action,
        actionDescription: ruleEvaluation.actionDescription,
        reasons: ruleEvaluation.reasons,
        mlProbability: mlEvaluation.probability,
        mlProbabilityDisplay: mlEvaluation.probabilityDisplay,
        mlConfidence: mlEvaluation.confidenceLevel,
        mlBaseValue: mlEvaluation.baseValue,
        mlShapValues: mlEvaluation.shapValues,
        mlEfficiencyCheck: mlEvaluation.efficiencyCheck,
        mlFeatures: mlEvaluation.features,
        mlContributions: mlEvaluation.contributions,
        status: ruleEvaluation.riskBand === 'CRITICAL' ? 'INVESTIGATING' : 'PROCESSED',
        createdAt: new Date(Date.now() - (60 - i) * 60000)
      };

      historicalTxns.push(txnDoc);

      if (ruleEvaluation.riskBand !== 'LOW') {
        alertsToCreate.push({
          alertId: `ALT-DATA-${Date.now()}-${i}`,
          transactionId: txnDoc.transactionId,
          customerId: txnDoc.customerId,
          customerName: txnDoc.customerName,
          amount: txnDoc.amount,
          currency: txnDoc.currency,
          riskScore: txnDoc.ruleScore,
          riskBand: txnDoc.riskBand,
          actionRequired: txnDoc.action,
          topReasons: ruleEvaluation.reasons.filter(r => r.triggered).map(r => `${r.title} (+${r.points} pts)`),
          mlProbability: txnDoc.mlProbabilityDisplay,
          status: 'OPEN'
        });
      }
    }

    await Transaction.insertMany(historicalTxns);
    if (alertsToCreate.length > 0) {
      await Alert.insertMany(alertsToCreate);
    }
    console.log(`[Seeder] Seeded ${historicalTxns.length} real dataset transactions and ${alertsToCreate.length} triage alerts from FraudShield v2.`);
  }

  console.log('[Seeder] Data seeding completed successfully.');
}
