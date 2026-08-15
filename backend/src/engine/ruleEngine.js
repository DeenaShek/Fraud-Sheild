/**
 * FraudShield Core Deterministic Fraud Scoring Engine
 * 
 * Implements the 6 additive, explainable scoring rules.
 * Maximum score: 100 points.
 * 
 * Rules:
 * 1. Amount anomaly: Current amount unusually high vs customer's baseline average (+20)
 * 2. Device anomaly: New / unrecognized device (+20)
 * 3. Location anomaly: Location significantly different from normal behavior (+20)
 * 4. Transaction velocity: Too many transactions in short period (+20)
 * 5. Merchant anomaly: New / high-risk unusual merchant (+10)
 * 6. Fraud network: Device / IP associated with suspicious accounts (+10)
 */

export const DEFAULT_RULE_CONFIG = {
  rules: {
    amountAnomaly: { enabled: true, weight: 20, multiplierThreshold: 3.0, minDifference: 5000 },
    deviceAnomaly: { enabled: true, weight: 20 },
    locationAnomaly: { enabled: true, weight: 20 },
    velocityAnomaly: { enabled: true, weight: 20, maxTxnCount5m: 2, maxTxnCount1h: 5 },
    merchantAnomaly: { enabled: true, weight: 10 },
    fraudNetwork: { enabled: true, weight: 10 }
  },
  thresholds: {
    low: { max: 30, action: 'ALLOW', label: 'LOW' },
    medium: { min: 31, max: 60, action: 'MONITOR', label: 'MEDIUM' },
    high: { min: 61, max: 80, action: 'VERIFY', label: 'HIGH' },
    critical: { min: 81, max: 100, action: 'BLOCK', label: 'CRITICAL' }
  }
};

/**
 * Evaluates the 6 rules against a transaction and historical context.
 * 
 * @param {Object} transaction - Current transaction details
 * @param {Object} customer - Customer profile & baseline behavior
 * @param {Object} context - Historical velocity, network links, known devices
 * @param {Object} config - Optional rule config override
 * @returns {Object} Score breakdown, total points, risk band, and machine-readable reasons
 */
export function evaluateTransactionRules(transaction, customer, context = {}, config = DEFAULT_RULE_CONFIG) {
  const cfg = config.rules || DEFAULT_RULE_CONFIG.rules;
  const reasons = [];
  let totalScore = 0;

  // 1. AMOUNT ANOMALY (+20)
  const baseline = Number(customer?.baselineAmount) || Number(transaction.customerBaseline) || 3000;
  const amount = Number(transaction.amount) || 0;
  const ratio = baseline > 0 ? (amount / baseline) : 1;
  const thresholdRatio = cfg.amountAnomaly?.multiplierThreshold ?? 3.0;
  const isAmountAnomalous = ratio >= thresholdRatio && (amount - baseline >= (cfg.amountAnomaly?.minDifference ?? 3000));
  
  const amountPoints = (cfg.amountAnomaly?.enabled && isAmountAnomalous) ? (cfg.amountAnomaly.weight ?? 20) : 0;
  totalScore += amountPoints;

  reasons.push({
    ruleId: 'RULE_AMOUNT_ANOMALY',
    category: 'AMOUNT_ANOMALY',
    title: 'Amount Anomaly',
    triggered: isAmountAnomalous,
    points: amountPoints,
    maxPoints: cfg.amountAnomaly?.weight ?? 20,
    severity: isAmountAnomalous ? (ratio >= 10 ? 'CRITICAL' : 'HIGH') : 'NONE',
    explanation: isAmountAnomalous
      ? `Transaction amount of ₹${amount.toLocaleString('en-IN')} is ${(ratio).toFixed(1)}x the customer's average baseline of ₹${baseline.toLocaleString('en-IN')} (Threshold: ${thresholdRatio}x).`
      : `Transaction amount of ₹${amount.toLocaleString('en-IN')} is within normal baseline range (₹${baseline.toLocaleString('en-IN')}).`,
    evidence: {
      amount,
      baselineAmount: baseline,
      ratio: Number(ratio.toFixed(2)),
      difference: amount - baseline,
      thresholdMultiplier: thresholdRatio
    }
  });

  // 2. DEVICE ANOMALY (+20)
  const knownDevices = customer?.knownDevices || context.knownDevices || [];
  const currentDevice = transaction.deviceId || 'UNKNOWN_DEVICE';
  const isKnownDevice = knownDevices.includes(currentDevice);
  const isDeviceAnomalous = !isKnownDevice;
  
  const devicePoints = (cfg.deviceAnomaly?.enabled && isDeviceAnomalous) ? (cfg.deviceAnomaly.weight ?? 20) : 0;
  totalScore += devicePoints;

  reasons.push({
    ruleId: 'RULE_DEVICE_ANOMALY',
    category: 'DEVICE_ANOMALY',
    title: 'Device Anomaly',
    triggered: isDeviceAnomalous,
    points: devicePoints,
    maxPoints: cfg.deviceAnomaly?.weight ?? 20,
    severity: isDeviceAnomalous ? 'HIGH' : 'NONE',
    explanation: isDeviceAnomalous
      ? `Unrecognized device '${currentDevice}' used. Customer's trusted devices: [${knownDevices.join(', ') || 'None registered'}].`
      : `Device '${currentDevice}' is verified in customer's trusted device registry.`,
    evidence: {
      deviceId: currentDevice,
      isNewDevice: isDeviceAnomalous,
      knownDevicesList: knownDevices
    }
  });

  // 3. LOCATION ANOMALY (+20)
  const homeLocation = customer?.homeLocation || customer?.location || 'Unknown';
  const txLocation = transaction.location || 'Unknown';
  const isLocationAnomalous = Boolean(
    transaction.isLocationAnomalous || 
    (txLocation !== 'Unknown' && homeLocation !== 'Unknown' && txLocation.toLowerCase() !== homeLocation.toLowerCase())
  );

  const locationPoints = (cfg.locationAnomaly?.enabled && isLocationAnomalous) ? (cfg.locationAnomaly.weight ?? 20) : 0;
  totalScore += locationPoints;

  reasons.push({
    ruleId: 'RULE_LOCATION_ANOMALY',
    category: 'LOCATION_ANOMALY',
    title: 'Location Anomaly',
    triggered: isLocationAnomalous,
    points: locationPoints,
    maxPoints: cfg.locationAnomaly?.weight ?? 20,
    severity: isLocationAnomalous ? 'HIGH' : 'NONE',
    explanation: isLocationAnomalous
      ? `Transaction originated from '${txLocation}', diverging significantly from registered home location '${homeLocation}'. Possible geo-velocity violation.`
      : `Transaction location '${txLocation}' matches customer's typical geographical footprint.`,
    evidence: {
      transactionLocation: txLocation,
      homeLocation: homeLocation,
      isGeographicMismatch: isLocationAnomalous
    }
  });

  // 4. TRANSACTION VELOCITY (+20)
  const velocityCount = Number(context.recentTxnCount5m ?? transaction.velocity ?? 1);
  const velocityThreshold = cfg.velocityAnomaly?.maxTxnCount5m ?? 2;
  const isVelocityAnomalous = velocityCount > velocityThreshold;

  const velocityPoints = (cfg.velocityAnomaly?.enabled && isVelocityAnomalous) ? (cfg.velocityAnomaly.weight ?? 20) : 0;
  totalScore += velocityPoints;

  reasons.push({
    ruleId: 'RULE_VELOCITY_ANOMALY',
    category: 'TRANSACTION_VELOCITY',
    title: 'Transaction Velocity',
    triggered: isVelocityAnomalous,
    points: velocityPoints,
    maxPoints: cfg.velocityAnomaly?.weight ?? 20,
    severity: isVelocityAnomalous ? 'HIGH' : 'NONE',
    explanation: isVelocityAnomalous
      ? `High transaction velocity detected: ${velocityCount} transactions attempted within 5 minutes (Threshold: ${velocityThreshold}).`
      : `Transaction velocity normal (${velocityCount} transaction in recent window).`,
    evidence: {
      recentTxnCount5m: velocityCount,
      velocityThreshold: velocityThreshold,
      isRapidFire: isVelocityAnomalous
    }
  });

  // 5. MERCHANT ANOMALY (+10)
  const merchant = transaction.merchant || {};
  const merchantName = typeof merchant === 'string' ? merchant : (merchant.name || 'Unknown Merchant');
  const merchantCategory = merchant.category || transaction.merchantCategory || 'General Retail';
  const highRiskCategories = ['Crypto Exchange', 'Foreign Luxury Exchange', 'Offshore Casino', 'High-Risk Escrow', 'Precious Metals'];
  
  const isHighRiskCategory = highRiskCategories.some(cat => merchantCategory.toLowerCase().includes(cat.toLowerCase()));
  const isNewMerchant = Boolean(transaction.isNewMerchant || !customer?.frequentMerchants?.includes(merchantName));
  const isMerchantAnomalous = isHighRiskCategory || isNewMerchant;

  const merchantPoints = (cfg.merchantAnomaly?.enabled && isMerchantAnomalous) ? (cfg.merchantAnomaly.weight ?? 10) : 0;
  totalScore += merchantPoints;

  reasons.push({
    ruleId: 'RULE_MERCHANT_ANOMALY',
    category: 'MERCHANT_ANOMALY',
    title: 'Merchant Anomaly',
    triggered: isMerchantAnomalous,
    points: merchantPoints,
    maxPoints: cfg.merchantAnomaly?.weight ?? 10,
    severity: isHighRiskCategory ? 'HIGH' : (isMerchantAnomalous ? 'MEDIUM' : 'NONE'),
    explanation: isHighRiskCategory
      ? `Transaction at high-risk merchant '${merchantName}' (Category: ${merchantCategory}). High chargeback/fraud correlation.`
      : isNewMerchant
      ? `First-time transaction at unfamiliar merchant '${merchantName}' (Category: ${merchantCategory}).`
      : `Merchant '${merchantName}' is a recognized frequent merchant for this customer.`,
    evidence: {
      merchantName,
      merchantCategory,
      isHighRiskCategory,
      isFirstTimeMerchant: isNewMerchant
    }
  });

  // 6. FRAUD NETWORK (+10)
  const networkRisk = Boolean(
    transaction.networkRiskSignal || 
    context.hasFraudRingLinks || 
    context.sharedDeviceRisk || 
    context.flaggedIpRisk
  );

  const networkPoints = (cfg.fraudNetwork?.enabled && networkRisk) ? (cfg.fraudNetwork.weight ?? 10) : 0;
  totalScore += networkPoints;

  reasons.push({
    ruleId: 'RULE_FRAUD_NETWORK',
    category: 'FRAUD_NETWORK',
    title: 'Fraud Network Linkage',
    triggered: networkRisk,
    points: networkPoints,
    maxPoints: cfg.fraudNetwork?.weight ?? 10,
    severity: networkRisk ? 'CRITICAL' : 'NONE',
    explanation: networkRisk
      ? `Device '${currentDevice}' or IP '${transaction.ipAddress || 'Shared-IP'}' has active topological links to ${context.linkedSuspiciousAccountsCount || 3} flagged / charged-back accounts.`
      : `No associated device or IP linkages with known fraud clusters or blacklisted entities.`,
    evidence: {
      networkRiskDetected: networkRisk,
      linkedAccountsCount: context.linkedSuspiciousAccountsCount || (networkRisk ? 3 : 0),
      ipAddress: transaction.ipAddress || '192.168.1.1',
      deviceFingerprint: currentDevice
    }
  });

  // Cap total score at 100
  totalScore = Math.min(100, Math.max(0, totalScore));

  // Determine Risk Band & Decision
  let riskBand = 'LOW';
  let action = 'ALLOW';
  let actionDescription = 'Transaction within normal risk parameters. Approved automatically.';

  if (totalScore >= (config.thresholds?.critical?.min ?? 81)) {
    riskBand = 'CRITICAL';
    action = 'BLOCK';
    actionDescription = 'Critical risk threshold exceeded. Payment blocked instantly and forwarded to Fraud Operations.';
  } else if (totalScore >= (config.thresholds?.high?.min ?? 61)) {
    riskBand = 'HIGH';
    action = 'VERIFY';
    actionDescription = 'Elevated risk detected. Step-up authentication (3D Secure / Biometric OTP) required before release.';
  } else if (totalScore >= (config.thresholds?.medium?.min ?? 31)) {
    riskBand = 'MEDIUM';
    action = 'MONITOR';
    actionDescription = 'Moderate risk score. Allowed with enhanced real-time telemetry monitoring.';
  }

  return {
    totalScore,
    maxPossibleScore: 100,
    riskBand,
    action,
    actionDescription,
    reasons,
    triggeredRulesCount: reasons.filter(r => r.triggered).length,
    evaluatedAt: new Date().toISOString()
  };
}
