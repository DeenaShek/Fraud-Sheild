/**
 * FraudShield Network Graph Engine
 * 
 * Manages entity relationship mapping between Customers, Devices, IP Addresses, Cards, and Merchants.
 * Detects syndicate rings, shared hardware fingerprints, and mule account clusters.
 */

export class NetworkGraphEngine {
  constructor() {
    // In-memory graph nodes & edges
    this.nodes = new Map(); // id -> { id, type, label, riskLevel, properties }
    this.edges = [];        // [ { source, target, relationship, timestamp, weight } ]
    this.seedKnownSyndicates();
  }

  seedKnownSyndicates() {
    // Seed standard fraud cluster for Dubai/Mule Ring (connected to D999)
    this.addNode({ id: 'D999', type: 'DEVICE', label: 'Device D999 (iPhone 16 Pro Max - Dubai)', riskLevel: 'CRITICAL', properties: { os: 'iOS 18.2', firstSeen: '2026-08-14' } });
    this.addNode({ id: 'IP_185_220_101', type: 'IP', label: 'IP 185.220.101.44 (Dubai VPN / Exit Node)', riskLevel: 'HIGH', properties: { country: 'UAE', isp: 'Datacenter Proxy' } });
    this.addNode({ id: 'CUST-1044', type: 'CUSTOMER', label: 'Tariq Al-Mansoor (CUST-1044)', riskLevel: 'CRITICAL', properties: { status: 'Suspended', chargebackCount: 3 } });
    this.addNode({ id: 'CUST-9012', type: 'CUSTOMER', label: 'Elena Rostova (CUST-9012)', riskLevel: 'CRITICAL', properties: { status: 'Blacklisted', fraudConfirmed: true } });
    this.addNode({ id: 'M_EMIRATES_LUX', type: 'MERCHANT', label: 'Emirates Gold & Luxury Watch Exchange', riskLevel: 'HIGH', properties: { category: 'Foreign Luxury Exchange' } });
    this.addNode({ id: 'CARD_7721', type: 'CARD', label: 'Virtual Prepaid VISA *7721', riskLevel: 'CRITICAL', properties: { issuer: 'Fintech NeoBank', bin: '411122' } });

    // Linkages for the known syndicate
    this.addEdge('D999', 'IP_185_220_101', 'USED_IP', 0.9);
    this.addEdge('CUST-1044', 'D999', 'SHARED_DEVICE', 0.95);
    this.addEdge('CUST-9012', 'D999', 'SHARED_DEVICE', 0.95);
    this.addEdge('CUST-1044', 'CARD_7721', 'FUNDED_CARD', 0.85);
    this.addEdge('D999', 'M_EMIRATES_LUX', 'PURCHASED_AT', 0.8);
  }

  addNode(node) {
    if (!this.nodes.has(node.id)) {
      this.nodes.set(node.id, {
        id: node.id,
        type: node.type, // 'CUSTOMER', 'DEVICE', 'IP', 'MERCHANT', 'CARD'
        label: node.label || node.id,
        riskLevel: node.riskLevel || 'LOW',
        properties: node.properties || {},
        createdAt: new Date().toISOString()
      });
    }
  }

  addEdge(source, target, relationship, weight = 0.5) {
    const exists = this.edges.some(e => e.source === source && e.target === target && e.relationship === relationship);
    if (!exists) {
      this.edges.push({
        source,
        target,
        relationship, // 'USED_DEVICE', 'USED_IP', 'TRANSFERRED_TO', 'SHARED_DEVICE', 'PURCHASED_AT'
        weight,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Registers a transaction into the network graph dynamically.
   */
  ingestTransaction(transaction, customer) {
    const custId = customer?.customerId || transaction.customerId || 'CUST_UNKNOWN';
    const deviceId = transaction.deviceId || 'DEV_UNKNOWN';
    const ip = transaction.ipAddress || 'IP_UNKNOWN';
    const merchantId = transaction.merchant?.id || transaction.merchant?.name || 'M_UNKNOWN';
    const cardId = transaction.cardLast4 ? `CARD_${transaction.cardLast4}` : null;

    this.addNode({
      id: custId,
      type: 'CUSTOMER',
      label: customer?.name ? `${customer.name} (${custId})` : custId,
      riskLevel: transaction.riskBand || 'LOW',
      properties: { homeLocation: customer?.homeLocation, baseline: customer?.baselineAmount }
    });

    this.addNode({
      id: deviceId,
      type: 'DEVICE',
      label: `Device ${deviceId}`,
      riskLevel: (deviceId === 'D999' || transaction.riskBand === 'CRITICAL') ? 'CRITICAL' : 'LOW',
      properties: { os: transaction.deviceOs || 'Mobile/Web' }
    });

    this.addNode({
      id: ip,
      type: 'IP',
      label: `IP ${ip}`,
      riskLevel: (ip.includes('185.220') || transaction.riskBand === 'CRITICAL') ? 'HIGH' : 'LOW',
      properties: { location: transaction.location }
    });

    if (merchantId) {
      this.addNode({
        id: merchantId,
        type: 'MERCHANT',
        label: typeof transaction.merchant === 'string' ? transaction.merchant : (transaction.merchant?.name || merchantId),
        riskLevel: transaction.isHighRiskMerchant ? 'HIGH' : 'LOW',
        properties: { category: transaction.merchant?.category }
      });
    }

    if (cardId) {
      this.addNode({
        id: cardId,
        type: 'CARD',
        label: `Card *${transaction.cardLast4}`,
        riskLevel: 'LOW',
        properties: { type: transaction.cardType || 'Visa' }
      });
    }

    // Connect edges
    this.addEdge(custId, deviceId, 'USED_DEVICE', 0.8);
    this.addEdge(deviceId, ip, 'USED_IP', 0.7);
    if (merchantId) this.addEdge(custId, merchantId, 'TRANSACTED_WITH', 0.6);
    if (cardId) this.addEdge(custId, cardId, 'OWNS_CARD', 0.9);
  }

  /**
   * Extracts the subgraph (1-hop or 2-hop neighborhood) around an entity.
   */
  getSubgraphForEntity(entityId, maxHops = 2) {
    const visitedNodes = new Set([entityId]);
    let currentFrontier = [entityId];

    for (let hop = 0; hop < maxHops; hop++) {
      const nextFrontier = [];
      for (const node of currentFrontier) {
        for (const edge of this.edges) {
          if (edge.source === node && !visitedNodes.has(edge.target)) {
            visitedNodes.add(edge.target);
            nextFrontier.push(edge.target);
          } else if (edge.target === node && !visitedNodes.has(edge.source)) {
            visitedNodes.add(edge.source);
            nextFrontier.push(edge.source);
          }
        }
      }
      currentFrontier = nextFrontier;
    }

    const subNodes = Array.from(visitedNodes)
      .map(id => this.nodes.get(id) || { id, type: 'UNKNOWN', label: id, riskLevel: 'LOW' });

    const subEdges = this.edges.filter(
      e => visitedNodes.has(e.source) && visitedNodes.has(e.target)
    );

    // Calculate metrics
    const criticalNodes = subNodes.filter(n => n.riskLevel === 'CRITICAL').length;
    const highRiskNodes = subNodes.filter(n => n.riskLevel === 'HIGH').length;

    return {
      centerEntityId: entityId,
      nodes: subNodes,
      links: subEdges.map(e => ({ source: e.source, target: e.target, relationship: e.relationship, weight: e.weight })),
      metrics: {
        totalEntities: subNodes.length,
        totalConnections: subEdges.length,
        criticalEntitiesCount: criticalNodes,
        highRiskEntitiesCount: highRiskNodes,
        syndicateThreatLevel: criticalNodes >= 2 ? 'CRITICAL_RING_DETECTED' : (criticalNodes === 1 ? 'ELEVATED' : 'CLEAN')
      }
    };
  }

  /**
   * Returns complete graph data for high-level visualization.
   */
  getFullGraph() {
    return {
      nodes: Array.from(this.nodes.values()),
      links: this.edges.map(e => ({ source: e.source, target: e.target, relationship: e.relationship, weight: e.weight }))
    };
  }
}

export const networkGraphEngine = new NetworkGraphEngine();
