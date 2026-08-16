import test from 'node:test';
import assert from 'node:assert/strict';
import { eventBus, TOPICS } from '../src/events/eventBus.js';

test('EventBus Suite - 1. Topic Pub/Sub Lifecycle', (t, done) => {
  const testPayload = {
    transactionId: 'TX-TEST-999',
    amount: 25000,
    customerId: 'CUST-1001'
  };

  const handler = (envelope) => {
    assert.equal(envelope.topic, TOPICS.TRANSACTION_CREATED);
    assert.equal(envelope.payload.transactionId, 'TX-TEST-999');
    assert.ok(envelope.timestamp);
    assert.ok(envelope.eventId);
    eventBus.unsubscribe(TOPICS.TRANSACTION_CREATED, handler);
    done();
  };

  eventBus.subscribe(TOPICS.TRANSACTION_CREATED, handler);
  eventBus.publish(TOPICS.TRANSACTION_CREATED, testPayload);
});

test('EventBus Suite - 2. Decoupled Pipeline Topic Routing & Telemetry', () => {
  const initialTelemetry = eventBus.getTelemetry();
  assert.ok(initialTelemetry.topics.includes(TOPICS.TRANSACTION_CREATED));
  assert.ok(initialTelemetry.topics.includes(TOPICS.TRANSACTION_SCORED));
  assert.ok(initialTelemetry.topics.includes(TOPICS.ALERT_RAISED));
  assert.ok(initialTelemetry.topics.includes(TOPICS.INVESTIGATION_RESOLVED));

  const initialCount = initialTelemetry.messagesPublished;

  eventBus.publish(TOPICS.TRANSACTION_SCORED, {
    transaction: { transactionId: 'TX-SCORED-1' },
    ruleEvaluation: { totalScore: 85, riskBand: 'CRITICAL' }
  });

  eventBus.publish(TOPICS.ALERT_RAISED, {
    alertId: 'ALT-100',
    transactionId: 'TX-SCORED-1',
    riskScore: 85
  });

  const updatedTelemetry = eventBus.getTelemetry();
  assert.equal(updatedTelemetry.messagesPublished, initialCount + 2);
  assert.ok(updatedTelemetry.topicCounts[TOPICS.TRANSACTION_SCORED] >= 1);
  assert.ok(updatedTelemetry.topicCounts[TOPICS.ALERT_RAISED] >= 1);
});
