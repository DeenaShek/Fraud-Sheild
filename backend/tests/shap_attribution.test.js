import test from 'node:test';
import assert from 'node:assert/strict';
import { fraudMLModel } from '../src/engine/mlModel.js';
import { transactionGenerator } from '../src/simulator/transactionGenerator.js';

test('SHAP Attribution Suite - 1. Exact Efficiency / Local Accuracy on 30 Diverse Transactions', () => {
  const sampleCustomers = [
    {
      customerId: 'CUST-8021',
      name: 'Ramesh Kumar',
      baselineAmount: 3200,
      knownDevices: ['D101', 'D102'],
      homeLocation: 'Chennai, India',
      frequentMerchants: ['Swiggy', 'Amazon IN']
    },
    {
      customerId: 'CUST-1045',
      name: 'Priya Sharma',
      baselineAmount: 12000,
      knownDevices: ['D505'],
      homeLocation: 'Mumbai, India',
      frequentMerchants: ['Starbucks', 'Flipkart']
    },
    {
      customerId: 'CUST-9901',
      name: 'Vikram Singh',
      baselineAmount: 850,
      knownDevices: ['D888'],
      homeLocation: 'Bengaluru, India',
      frequentMerchants: ['Zomato', 'Uber']
    }
  ];

  // Generate diverse transaction scenarios
  const testTransactions = [
    // 1. Worked example
    transactionGenerator.generateWorkedExampleTransaction(),
    // 2. Merchant anomaly only
    transactionGenerator.generateMerchantAnomalyOnlyTransaction(),
    // 3. Device anomaly only
    transactionGenerator.generateDeviceAnomalyOnlyTransaction(),
    // 4. Travel anomaly
    transactionGenerator.generateTravelAnomalyTransaction(),
    // 5. Completely clean transaction
    {
      amount: 1500,
      deviceId: 'D101',
      location: 'Chennai, India',
      velocity: 1,
      merchant: { name: 'Swiggy', category: 'Food Delivery' },
      networkRiskSignal: false,
      customerId: 'CUST-8021',
      timestamp: new Date('2026-08-16T14:00:00Z')
    }
  ];

  // Add 25 random transactions from generator
  for (let i = 0; i < 25; i++) {
    testTransactions.push(transactionGenerator.generateRandomTransaction(sampleCustomers));
  }

  assert.equal(testTransactions.length, 30, 'Should test exactly 30 transactions');

  let passedChecks = 0;
  for (let i = 0; i < testTransactions.length; i++) {
    const rawTxn = testTransactions[i];
    const customer = sampleCustomers.find(c => c.customerId === rawTxn.customerId) || sampleCustomers[0];
    const context = {
      knownDevices: customer.knownDevices || [rawTxn.deviceId],
      recentTxnCount5m: rawTxn.velocity || 1,
      hasFraudRingLinks: Boolean(rawTxn.networkRiskSignal)
    };

    const res = fraudMLModel.evaluate(rawTxn, customer, context);

    assert.ok(res.shapValues && res.shapValues.length === 7, `Txn ${i}: Must have 7 SHAP feature values`);
    assert.ok(typeof res.baseValue === 'number', `Txn ${i}: Must have numeric baseValue`);
    assert.ok(typeof res.probability === 'number', `Txn ${i}: Must have numeric probability`);

    const sumShap = res.shapValues.reduce((sum, s) => sum + s.contribution, 0);
    const reconstructed = res.baseValue + sumShap;
    const delta = Math.abs(res.probability - reconstructed);

    assert.ok(
      delta < 0.001, 
      `Txn ${i} failed SHAP efficiency check: baseValue (${res.baseValue}) + sumShap (${sumShap}) = ${reconstructed}, actual probability = ${res.probability}, delta = ${delta}`
    );

    assert.equal(res.efficiencyCheck.isValid, true, `Txn ${i}: efficiencyCheck.isValid must be true`);
    passedChecks++;
  }

  assert.equal(passedChecks, 30, 'All 30 transactions passed exact SHAP efficiency validation');
});

test('SHAP Attribution Suite - 2. Neutral Baseline Produces Zero Attributions', () => {
  const neutralCustomer = {
    customerId: 'CUST-BASE',
    baselineAmount: 5000,
    knownDevices: ['D-TRUSTED'],
    homeLocation: 'Delhi, India',
    frequentMerchants: ['Swiggy']
  };

  const neutralTxn = {
    amount: 5000, // exact baseline
    deviceId: 'D-TRUSTED',
    location: 'Delhi, India',
    velocity: 1,
    merchant: { name: 'Swiggy' },
    networkRiskSignal: false,
    timestamp: new Date('2026-08-16T14:00:00Z') // daytime
  };

  const res = fraudMLModel.evaluate(neutralTxn, neutralCustomer, { knownDevices: ['D-TRUSTED'] });

  assert.ok(res.probability <= 0.05, 'Neutral transaction should have very low base probability');
  
  // Every SHAP contribution should be ~0
  for (const s of res.shapValues) {
    assert.equal(s.contribution, 0, `Feature ${s.feature} should have 0 contribution for neutral input`);
    assert.equal(s.direction, 'neutral');
  }

  assert.equal(res.efficiencyCheck.isValid, true);
});
