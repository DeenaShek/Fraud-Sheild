import { EventEmitter } from 'events';

/**
 * FraudShield Event Bus — Kafka-ready Pub/Sub Streaming Infrastructure.
 *
 * Structured to mirror Kafka's topic/producer/consumer model so that
 * swapping in a real Kafka client (e.g. kafkajs or confluent-kafka-javascript)
 * later requires changing only this file's driver internals, not any business logic.
 *
 * TOPICS:
 *   transaction.created    — new incoming transaction ingested from payment gateway
 *   transaction.scored     — deterministic rule engine + ML scoring complete
 *   alert.raised           — risk band > LOW, alert created & queued for investigation
 *   investigation.resolved — analyst action & final disposition recorded
 */
class FraudShieldEventBus extends EventEmitter {
  constructor() {
    super();
    // Allow ample listeners for decoupled consumers & metrics monitors
    this.setMaxListeners(50);
    this.telemetry = {
      messagesPublished: 0,
      topicCounts: {
        'transaction.created': 0,
        'transaction.scored': 0,
        'alert.raised': 0,
        'investigation.resolved': 0
      },
      lastEventAt: null
    };
  }

  /**
   * Publish an event to a designated Kafka-style topic.
   * 
   * @param {string} topic - Destination topic name
   * @param {Object} payload - Message payload (Key-value or Document)
   * @param {string} [key] - Optional partition key (e.g., customerId or transactionId)
   */
  publish(topic, payload, key = null) {
    this.telemetry.messagesPublished++;
    this.telemetry.topicCounts[topic] = (this.telemetry.topicCounts[topic] || 0) + 1;
    this.telemetry.lastEventAt = new Date().toISOString();

    const eventEnvelope = {
      topic,
      key: key || payload?.transactionId || payload?.customerId || null,
      payload,
      timestamp: new Date().toISOString(),
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
    };

    this.emit(topic, eventEnvelope);
    return eventEnvelope;
  }

  /**
   * Subscribe an independent consumer to a named topic.
   * 
   * @param {string} topic - Topic to consume from
   * @param {Function} handler - Message handler callback
   */
  subscribe(topic, handler) {
    this.on(topic, handler);
  }

  /**
   * Unsubscribe a consumer from a topic.
   */
  unsubscribe(topic, handler) {
    this.off(topic, handler);
  }

  /**
   * Get telemetry stats for admin health and pipeline diagnostics.
   */
  getTelemetry() {
    return {
      architecture: 'Kafka-Ready Decoupled Topic Pub/Sub',
      transport: 'In-Memory Event Bus (Zero-Dependency Local Broker)',
      topics: Object.keys(this.telemetry.topicCounts),
      ...this.telemetry
    };
  }
}

export const eventBus = new FraudShieldEventBus();

export const TOPICS = {
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_SCORED: 'transaction.scored',
  ALERT_RAISED: 'alert.raised',
  INVESTIGATION_RESOLVED: 'investigation.resolved',
  PAYMENT_SETTLED: 'payment.settled',
  PAYMENT_HELD: 'payment.held'
};
