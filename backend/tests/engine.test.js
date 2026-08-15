import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateTransactionRules, DEFAULT_RULE_CONFIG } from '../src/engine/ruleEngine.js';
import { fraudMLModel } from '../src/engine/mlModel.js';
import { policyRetriever } from '../src/rag/retriever.js';
import { investigationCopilot } from '../src/rag/llmCopilot.js';
import { networkGraphEngine } from '../src/engine/networkGraph.js';
import { transactionGenerator } from '../src/simulator/transactionGenerator.js';

test('1. Rule Engine - Evaluates Normal Low-Risk Transaction (0 pts, Allow)', () => {
  const normalTxn = {
    amount: 1500,
    deviceId: 'D101',
    location: 'Chennai, India',
    velocity: 1,
    merchant: { name: 'Swiggy', category: 'Food Delivery' },
    networkRiskSignal: false
  };

  const customer = {
    baselineAmount: 3200,
    knownDevices: ['D101', 'D102'],
    homeLocation: 'Chennai, India',
    frequentMerchants: ['Swiggy', 'Amazon IN']
  };

  const result = evaluateTransactionRules(normalTxn, customer, { knownDevices: customer.knownDevices });

  assert.equal(result.totalScore, 0);
  assert.equal(result.riskBand, 'LOW');
  assert.equal(result.action, 'ALLOW');
  assert.equal(result.triggeredRulesCount, 0);
});

test('2. Partial Scoring - Merchant Anomaly Only (+10 pts)', () => {
  // Clean customer transacting at luxury merchant from home city on trusted device
  const rawTxn = transactionGenerator.generateMerchantAnomalyOnlyTransaction();
  const customer = {
    customerId: 'CUST-8021',
    baselineAmount: 3200,
    knownDevices: ['D101', 'D102'],
    homeLocation: 'Chennai, India',
    frequentMerchants: ['Swiggy', 'Amazon IN']
  };

  const context = {
    knownDevices: customer.knownDevices,
    recentTxnCount5m: 1,
    hasFraudRingLinks: false
  };

  const result = evaluateTransactionRules(rawTxn, customer, context);

  assert.equal(result.totalScore, 10, 'Only Rule 5 should fire (+10 pts)');
  assert.equal(result.riskBand, 'LOW');
  assert.equal(result.action, 'ALLOW');
  assert.equal(result.triggeredRulesCount, 1);

  const merchantRule = result.reasons.find(r => r.category === 'MERCHANT_ANOMALY');
  const networkRule = result.reasons.find(r => r.category === 'FRAUD_NETWORK');
  const deviceRule = result.reasons.find(r => r.category === 'DEVICE_ANOMALY');

  assert.equal(merchantRule.triggered, true);
  assert.equal(merchantRule.points, 10);
  assert.equal(networkRule.triggered, false);
  assert.equal(networkRule.points, 0);
  assert.equal(deviceRule.triggered, false);
  assert.equal(deviceRule.points, 0);
});

test('3. Partial Scoring - New Device Only (+20 pts)', () => {
  const rawTxn = transactionGenerator.generateDeviceAnomalyOnlyTransaction();
  const customer = {
    customerId: 'CUST-8021',
    baselineAmount: 3200,
    knownDevices: ['D101', 'D102'],
    homeLocation: 'Chennai, India',
    frequentMerchants: ['Swiggy', 'Amazon IN']
  };

  const context = {
    knownDevices: customer.knownDevices,
    recentTxnCount5m: 1,
    hasFraudRingLinks: false
  };

  const result = evaluateTransactionRules(rawTxn, customer, context);

  assert.equal(result.totalScore, 20);
  assert.equal(result.riskBand, 'LOW');
  assert.equal(result.action, 'ALLOW');
  assert.equal(result.triggeredRulesCount, 1);

  const deviceRule = result.reasons.find(r => r.category === 'DEVICE_ANOMALY');
  assert.equal(deviceRule.triggered, true);
  assert.equal(deviceRule.points, 20);
});

test('4. Partial Scoring - Travel Anomaly (+40 pts - Device + Location)', () => {
  const rawTxn = transactionGenerator.generateTravelAnomalyTransaction();
  const customer = {
    customerId: 'CUST-8021',
    baselineAmount: 3200,
    knownDevices: ['D101', 'D102'],
    homeLocation: 'Chennai, India',
    frequentMerchants: ['Starbucks Coffee']
  };

  const context = {
    knownDevices: customer.knownDevices,
    recentTxnCount5m: 1,
    hasFraudRingLinks: false
  };

  const result = evaluateTransactionRules(rawTxn, customer, context);

  assert.equal(result.totalScore, 40);
  assert.equal(result.riskBand, 'MEDIUM');
  assert.equal(result.action, 'MONITOR');
  assert.equal(result.triggeredRulesCount, 2);
});

test('5. Rule Engine & ML - Validates Worked Example Specification (100 pts, Block)', () => {
  const suspiciousTxn = transactionGenerator.generateWorkedExampleTransaction();
  const customer = {
    customerId: 'CUST-8021',
    baselineAmount: 3200,
    knownDevices: ['D101'],
    homeLocation: 'Chennai, India',
    frequentMerchants: ['Swiggy', 'Amazon IN']
  };

  const context = {
    knownDevices: customer.knownDevices,
    recentTxnCount5m: 4,
    hasFraudRingLinks: true,
    linkedSuspiciousAccountsCount: 3
  };

  const ruleResult = evaluateTransactionRules(suspiciousTxn, customer, context);

  assert.equal(ruleResult.totalScore, 100, 'Score must equal 100 points');
  assert.equal(ruleResult.riskBand, 'CRITICAL', 'Risk band must be CRITICAL');
  assert.equal(ruleResult.action, 'BLOCK', 'Action must be BLOCK');
  assert.equal(ruleResult.triggeredRulesCount, 6, 'All 6 rules must trigger');

  const mlResult = fraudMLModel.evaluate(suspiciousTxn, customer, context);
  assert.ok(mlResult.probability >= 0.90);
  assert.equal(mlResult.confidenceLevel, 'VERY HIGH');
});

test('6. RAG Knowledge Base & Policy Retriever', () => {
  const policies = policyRetriever.retrieveRelevantPolicies('What are the risk thresholds and step up action for high score?', 2);
  assert.ok(policies.length > 0);
  assert.equal(policies[0].id, 'POL-001');
  assert.ok(policies[0].fullContent.includes('BLOCK + INVESTIGATE'));
});

test('7. LLM Copilot - Answers 4 Investigator Questions with Grounded Evidence', async () => {
  const caseContext = {
    transaction: {
      transactionId: 'TX-WORKED-5001',
      amount: 85000,
      location: 'Dubai, UAE',
      deviceId: 'D999',
      merchant: { name: 'Emirates Gold' }
    },
    customer: {
      customerId: 'CUST-8021',
      name: 'Ramesh Kumar',
      baselineAmount: 3200,
      homeLocation: 'Chennai, India',
      knownDevices: ['D101']
    },
    ruleEvaluation: {
      totalScore: 100,
      riskBand: 'CRITICAL',
      action: 'BLOCK',
      reasons: [
        { title: 'Amount Anomaly', triggered: true, points: 20, explanation: 'Amount ₹85,000 is 26.5x baseline' },
        { title: 'Device Anomaly', triggered: true, points: 20, explanation: 'Unrecognized device D999' }
      ]
    },
    mlResult: { probability: 0.94, probabilityDisplay: '94%' },
    networkContext: networkGraphEngine.getSubgraphForEntity('D999', 2)
  };

  const q1 = await investigationCopilot.answerInvestigatorQuery('Why was this transaction flagged?', caseContext);
  assert.ok(q1.answer.includes('deterministic risk score'));

  const q2 = await investigationCopilot.answerInvestigatorQuery('What are the strongest risk indicators?', caseContext);
  assert.ok(q2.answer.includes('Amount Anomaly'));

  const q3 = await investigationCopilot.answerInvestigatorQuery('Summarize this case.', caseContext);
  assert.ok(q3.answer.includes('TX-WORKED-5001'));
  assert.ok(q3.answer.includes('Ramesh Kumar'));

  const q4 = await investigationCopilot.answerInvestigatorQuery('What should the investigator review next?', caseContext);
  assert.ok(q4.answer.includes('BLOCK'));
});
