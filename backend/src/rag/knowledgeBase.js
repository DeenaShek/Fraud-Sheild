/**
 * FraudShield Trusted Knowledge Base (RAG Grounding)
 * 
 * Contains authoritative bank policies, risk thresholds, standard operating procedures (SOP),
 * escalation protocols, merchant risk tiers, and approved historical case precedents.
 */

export const FRAUD_POLICIES = [
  {
    id: 'POL-001',
    title: 'Core Risk Score Thresholds & Required Actions',
    category: 'Risk Thresholds',
    effectiveDate: '2026-01-01',
    content: `
FraudShield operates on a 0-100 additive explainability scoring framework. Every transaction must be classified into one of four mandatory operational risk bands:
1. Low Risk (0 - 30 points): Mandatory Action: ALLOW. Frictionless automated clearing. No customer interruption.
2. Medium Risk (31 - 60 points): Mandatory Action: MONITOR. Allowed with passive backend telemetry and post-authorization behavioral audit.
3. High Risk (61 - 80 points): Mandatory Action: VERIFY. Enforce Step-up Authentication (3DS 2.2 biometric verification or out-of-band SMS/WhatsApp OTP). Hold funds until verification completes.
4. Critical Risk (81 - 100 points): Mandatory Action: BLOCK + INVESTIGATE. Immediate real-time payment rejection. Freeze active session token, generate critical alert, and auto-route case to Level 2 Fraud Operations.
    `,
    keywords: ['thresholds', 'risk bands', 'allow', 'monitor', 'verify', 'block', 'scoring', 'points', 'action', 'step-up']
  },
  {
    id: 'POL-002',
    title: 'Amount Anomaly & Customer Baseline Evaluation SOP',
    category: 'Fraud Policy',
    effectiveDate: '2026-01-01',
    content: `
When evaluating transaction amounts against customer baseline:
- A rolling baseline is computed from the 90-day moving average of domestic and international cleared transactions.
- Multiplier Threshold: Any transaction exceeding 3.0x the baseline amount AND exceeding a ₹5,000 variance automatically accrues +20 points (Amount Anomaly).
- High Variance Extreme: If transaction exceeds 10x baseline, it is marked as an Extreme Anomaly, requiring cross-verification against customer income bracket and recent statement velocity.
- If a customer has submitted an Advance Travel / High-Value Purchase Notice in the mobile banking app, the threshold multiplier relaxes from 3.0x to 6.0x for approved merchant categories.
    `,
    keywords: ['amount anomaly', 'baseline', 'multiplier', 'rolling average', 'travel notice', 'limits', 'variance', 'extreme']
  },
  {
    id: 'POL-003',
    title: 'Device & Hardware Fingerprinting Verification SOP',
    category: 'Investigation Guidelines',
    effectiveDate: '2026-02-15',
    content: `
Device Anomaly Policy (+20 points):
- A device is classified as 'New / Unrecognized' if its cryptographic hardware fingerprint (Device ID) has not completed at least 2 successful MFA authentications in the preceding 30 days.
- When an unrecognized device pairs with a sudden location change or high amount ratio (Compound Anomaly), the risk of Account Takeover (ATO) or SIM swap exceeds 88%.
- Investigator Procedure: Check if the device OS version, language locale, and canvas fingerprint match recent session logins. If device is linked to >1 customer profile within 24 hours, treat as Device Farm / Syndicate hardware.
    `,
    keywords: ['device anomaly', 'hardware fingerprint', 'new device', 'account takeover', 'ato', 'sim swap', 'device farm', 'mfa']
  },
  {
    id: 'POL-004',
    title: 'Geographic Velocity & Cross-Border Location Policy',
    category: 'Fraud Policy',
    effectiveDate: '2026-01-10',
    content: `
Location Anomaly Policy (+20 points):
- Impossible Travel / Geo-Velocity: If a transaction originates from a physical location or IP address that is physically unreachable given the time elapsed since the previous transaction (speed > 800 km/h without airport transit indicator), flag immediately for Location Anomaly.
- High-Risk Offshore Jurisdictions: Transactions originating from high-risk corridors (e.g., Dubai UAE, Cyprus, Belize, certain offshore gaming jurisdictions) without registered travel itineraries must trigger Level 2 step-up verification.
    `,
    keywords: ['location anomaly', 'geo velocity', 'impossible travel', 'cross-border', 'international', 'dubai', 'uae', 'offshore', 'gps']
  },
  {
    id: 'POL-005',
    title: 'Merchant Category Risk Classification & Chargeback Tiers',
    category: 'Merchant Risk',
    effectiveDate: '2026-03-01',
    content: `
Merchant Anomaly Policy (+10 points):
- Tier 1 High-Risk Merchant Categories: Cryptocurrency Exchanges (MCC 6051), Foreign Luxury Goods / Gold Exchanges (MCC 5094, 5944), Offshore Casinos & Gambling (MCC 7995), Digital Escrow Services (MCC 7389).
- First-Time Merchant at High Risk: If a user has never transacted at a luxury goods or crypto exchange and makes an initial high-value debit, assign +10 points and mandate merchant KYC verification.
- Merchant Chargeback Rate: Any merchant with a trailing 30-day chargeback ratio > 1.2% is automatically restricted to Verified 3DS transactions only.
    `,
    keywords: ['merchant anomaly', 'merchant risk', 'crypto', 'luxury', 'gold exchange', 'gambling', 'chargeback', 'mcc']
  },
  {
    id: 'POL-006',
    title: 'Fraud Syndicate & Network Linkage Escalation Protocol',
    category: 'Escalation Procedures',
    effectiveDate: '2026-02-01',
    content: `
Fraud Network Policy (+10 points & Immediate Escalation):
- When a device ID, IP subnet (/24), or funding card is identified in the Graph Database as having topological links to 2 or more suspended, charged-back, or blacklisted customer accounts, flag as 'Syndicate Linked'.
- Escalation SOP:
  1. Freeze outgoing transactions immediately (BLOCK).
  2. Suspend beneficiary accounts if internal to bank.
  3. Submit an automated SAR (Suspicious Activity Report) filing draft to FIU-IND / AML compliance unit within 24 hours.
  4. Initiate secure customer callback verification via verified home phone number (do not call numbers from recent profile change).
    `,
    keywords: ['fraud network', 'syndicate', 'shared device', 'ip subnet', 'sar', 'aml', 'fiu', 'escalation', 'blacklist', 'mule']
  },
  {
    id: 'POL-007',
    title: 'Approved Historical Precedent: Case #FS-2025-098 (Dubai Luxury Ring ATO)',
    category: 'Historical Precedents',
    effectiveDate: '2025-11-20',
    content: `
Precedent Summary:
- Case Profile: Customer based in Chennai (domestic baseline ~₹3,500) had login compromised via phishing. Attacker used iPhone in Dubai (Device D999) to purchase ₹85,000 - ₹120,000 in gold bullion at Emirates Luxury Exchange.
- Engine Behavior: Amount Anomaly (+20), Device Anomaly (+20), Location Anomaly (+20), Velocity (+20), Merchant Anomaly (+10), Network Linkage (+10) -> Total Score: 100/100 (CRITICAL). ML Probability: 94%.
- Resolution Outcome: Instant block prevented ₹85,000 loss. Follow-up graph analysis revealed Device D999 was linked to 3 other compromised accounts. Syndicate dismantled.
- Guideline for Investigators: If transaction pattern matches this signature, enforce permanent device ban and mandate in-person branch KYC reset.
    `,
    keywords: ['precedent', 'historical case', 'dubai', 'chennai', 'd999', '85000', '3200', 'luxury', 'worked example', 'ato']
  }
];
