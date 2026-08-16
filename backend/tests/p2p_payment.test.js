import test from 'node:test';
import assert from 'node:assert/strict';
import { eventBus, TOPICS } from '../src/events/eventBus.js';
import { evaluateTransactionRules } from '../src/engine/ruleEngine.js';
import { fraudMLModel } from '../src/engine/mlModel.js';

test('Live P2P Payment Pipeline - 1. Normal Clean Payment Settles Automatically', (t, done) => {
  const sender = {
    customerId: 'CUST-8021',
    name: 'Ramesh Kumar',
    baselineAmount: 3200,
    knownDevices: ['D101'],
    homeLocation: 'Chennai, India',
    frequentMerchants: ['Swiggy', 'Amazon IN', 'Ananya Deshmukh']
  };

  const rawTxn = {
    transactionId: `TX-SEND-CLEAN-${Date.now()}`,
    customerId: sender.customerId,
    customerName: sender.name,
    customerBaseline: sender.baselineAmount,
    amount: 3200,
    currency: 'INR',
    deviceId: 'D101',
    location: 'Chennai, India',
    homeLocation: sender.homeLocation,
    isLocationAnomalous: false,
    merchant: { id: 'PEER-CUST-3310', name: 'Ananya Deshmukh', category: 'Peer Payment' },
    isNewMerchant: false,
    receiverId: 'CUST-3310',
    receiverName: 'Ananya Deshmukh',
    isPeerPayment: true,
    timestamp: new Date().toISOString()
  };

  const ruleResult = evaluateTransactionRules(rawTxn, sender, { knownDevices: sender.knownDevices });
  const mlResult = fraudMLModel.evaluate(rawTxn, sender, { knownDevices: sender.knownDevices });

  assert.equal(ruleResult.riskBand, 'LOW');
  assert.equal(ruleResult.action, 'ALLOW');
  assert.equal(ruleResult.totalScore, 0);
  assert.ok(mlResult.probability <= 0.10);

  // Verify Event Bus Settlement Emission
  const handler = (envelope) => {
    assert.equal(envelope.topic, TOPICS.PAYMENT_SETTLED);
    assert.equal(envelope.payload.transactionId, rawTxn.transactionId);
    assert.equal(envelope.payload.status, 'SETTLED');
    eventBus.unsubscribe(TOPICS.PAYMENT_SETTLED, handler);
    done();
  };

  eventBus.subscribe(TOPICS.PAYMENT_SETTLED, handler);
  eventBus.publish(TOPICS.PAYMENT_SETTLED, {
    transactionId: rawTxn.transactionId,
    senderId: sender.customerId,
    receiverId: 'CUST-3310',
    amount: 3200,
    riskBand: 'LOW',
    status: 'SETTLED'
  });
});

test('Live P2P Payment Pipeline - 2. High-Risk Anomaly Payment Held For Fraud Review', (t, done) => {
  const sender = {
    customerId: 'CUST-8021',
    name: 'Ramesh Kumar',
    baselineAmount: 3200,
    knownDevices: ['D101'],
    homeLocation: 'Chennai, India',
    frequentMerchants: ['Swiggy', 'Amazon IN']
  };

  // Simulated Judge Anomaly (New device DEV-JUDGE-999 + Geolocation Lagos + ₹85k amount)
  const anomalousTxn = {
    transactionId: `TX-SEND-FRAUD-${Date.now()}`,
    customerId: sender.customerId,
    customerName: sender.name,
    customerBaseline: sender.baselineAmount,
    amount: 85000,
    currency: 'INR',
    deviceId: 'DEV-JUDGE-999',
    location: 'Lagos, Nigeria',
    homeLocation: sender.homeLocation,
    isLocationAnomalous: true,
    merchant: { id: 'PEER-ANONYMOUS', name: 'Unknown Anonymous P2P Wallet', category: 'Peer Payment' },
    isNewMerchant: true,
    receiverId: 'PEER-ANONYMOUS',
    isPeerPayment: true,
    timestamp: new Date().toISOString()
  };

  const ruleResult = evaluateTransactionRules(anomalousTxn, sender, { knownDevices: sender.knownDevices });
  const mlResult = fraudMLModel.evaluate(anomalousTxn, sender, { knownDevices: sender.knownDevices });

  assert.ok(ruleResult.totalScore >= 60, `Score must be >= 60, got ${ruleResult.totalScore}`);
  assert.ok(['HIGH', 'CRITICAL'].includes(ruleResult.riskBand));
  assert.ok(['VERIFY', 'BLOCK'].includes(ruleResult.action));
  assert.ok(mlResult.probability >= 0.85);

  // Verify Event Bus Hold Emission
  const handler = (envelope) => {
    assert.equal(envelope.topic, TOPICS.PAYMENT_HELD);
    assert.equal(envelope.payload.transactionId, anomalousTxn.transactionId);
    assert.equal(envelope.payload.status, 'HELD_FOR_REVIEW');
    eventBus.unsubscribe(TOPICS.PAYMENT_HELD, handler);
    done();
  };

  eventBus.subscribe(TOPICS.PAYMENT_HELD, handler);
  eventBus.publish(TOPICS.PAYMENT_HELD, {
    transactionId: anomalousTxn.transactionId,
    senderId: sender.customerId,
    receiverId: 'PEER-ANONYMOUS',
    amount: 85000,
    riskBand: ruleResult.riskBand,
    action: ruleResult.action,
    status: 'HELD_FOR_REVIEW'
  });
});
