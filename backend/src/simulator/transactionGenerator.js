import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load real dataset sample v2 (2,000 items from 105k PaySim-augmented dataset)
let datasetRecords = [];
try {
  const datasetPath = path.join(__dirname, '..', 'data', 'datasets', 'fraudshield_seed_sample_v2.json');
  if (fs.existsSync(datasetPath)) {
    datasetRecords = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  }
} catch (e) {
  console.warn('[TransactionGenerator] Dataset file not loaded, fallback to generative mode.');
}

const NORMAL_MERCHANTS = [
  { id: 'M-SWIGGY', name: 'Swiggy', category: 'Food Delivery' },
  { id: 'M-ZOMATO', name: 'Zomato', category: 'Food Delivery' },
  { id: 'M-AMAZON', name: 'Amazon IN', category: 'E-Commerce' },
  { id: 'M-FLIPKART', name: 'Flipkart', category: 'E-Commerce' },
  { id: 'M-APOLLO', name: 'Apollo Pharmacy', category: 'Healthcare' },
  { id: 'M-INDIAN-OIL', name: 'Indian Oil Retail', category: 'Fuel' },
  { id: 'M-UBER', name: 'Uber Rides', category: 'Transport' },
  { id: 'M-STARBUCKS', name: 'Starbucks Coffee', category: 'Dining' }
];

const HIGH_RISK_MERCHANTS = [
  { id: 'M_EMIRATES_LUX', name: 'Emirates Gold & Luxury Watch Exchange', category: 'Foreign Luxury Exchange' },
  { id: 'M_CRYPTO_VAULT', name: 'Crypto Sovereign Vault', category: 'Crypto Exchange' },
  { id: 'M_CASINO_ROYALE', name: 'Monaco Royale Digital Casino', category: 'Offshore Casino' },
  { id: 'M_APEX_ESCROW', name: 'Apex High-Value Digital Escrow', category: 'High-Risk Escrow' }
];

let txnSequence = 5000;
let datasetIndex = 0;

export class TransactionGenerator {
  /**
   * Returns total available records in dataset
   */
  getDatasetRecordCount() {
    return datasetRecords.length;
  }
  /**
   * Benchmark Worked Example: 100/100 Points, All 6 Rules Fired, Critical -> Block
   */
  generateWorkedExampleTransaction() {
    txnSequence++;
    return {
      transactionId: `TX-WORKED-${txnSequence}`,
      customerId: 'CUST-8021',
      customerName: 'Ramesh Kumar',
      customerBaseline: 3200,
      amount: 85000,
      currency: 'INR',
      deviceId: 'D999',
      deviceOs: 'iOS 18.2 (iPhone 16 Pro Max)',
      location: 'Dubai, UAE',
      homeLocation: 'Chennai, India',
      isLocationAnomalous: true,
      ipAddress: '185.220.101.44',
      merchant: {
        id: 'M_EMIRATES_LUX',
        name: 'Emirates Gold & Luxury Watch Exchange',
        category: 'Foreign Luxury Exchange'
      },
      isNewMerchant: true,
      isHighRiskMerchant: true,
      velocity: 4,
      networkRiskSignal: true,
      cardLast4: '4412',
      cardType: 'Visa Platinum',
      isWorkedExample: true,
      scenarioName: '100 pts - All 6 Rules Fired (Dubai ATO Syndicate)',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Single-Rule Scenario: Merchant Anomaly Only (+10 pts)
   * Customer in Chennai, baseline ₹3,200, trusted device D101, normal amount ₹2,400, velocity 1, clean network.
   * Only Rule 5 fires for high-risk merchant category.
   */
  generateMerchantAnomalyOnlyTransaction() {
    txnSequence++;
    return {
      transactionId: `TX-MERCHANT-${txnSequence}`,
      customerId: 'CUST-8021',
      customerName: 'Ramesh Kumar',
      customerBaseline: 3200,
      amount: 2400,
      currency: 'INR',
      deviceId: 'D101',
      deviceOs: 'iOS 18.1 (iPhone 14)',
      location: 'Chennai, India',
      homeLocation: 'Chennai, India',
      isLocationAnomalous: false,
      ipAddress: '103.21.124.89',
      merchant: {
        id: 'M_EMIRATES_LUX',
        name: 'Emirates Gold & Luxury Watch Exchange',
        category: 'Foreign Luxury Exchange'
      },
      isNewMerchant: true,
      isHighRiskMerchant: true,
      velocity: 1,
      networkRiskSignal: false,
      cardLast4: '4412',
      cardType: 'Visa Platinum',
      scenarioName: 'Partial Score: Merchant Anomaly Only (+10 pts)',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Single-Rule Scenario: New Device Only (+20 pts)
   * Customer in Chennai, normal amount ₹2,800, trusted home location, frequent merchant (Swiggy),
   * but using a new unverified device D205.
   */
  generateDeviceAnomalyOnlyTransaction() {
    txnSequence++;
    return {
      transactionId: `TX-DEVICE-${txnSequence}`,
      customerId: 'CUST-8021',
      customerName: 'Ramesh Kumar',
      customerBaseline: 3200,
      amount: 2800,
      currency: 'INR',
      deviceId: 'D205',
      deviceOs: 'iPadOS 18.2 (iPad Air)',
      location: 'Chennai, India',
      homeLocation: 'Chennai, India',
      isLocationAnomalous: false,
      ipAddress: '103.21.124.89',
      merchant: {
        id: 'M-SWIGGY',
        name: 'Swiggy',
        category: 'Food Delivery'
      },
      isNewMerchant: false,
      isHighRiskMerchant: false,
      velocity: 1,
      networkRiskSignal: false,
      cardLast4: '4412',
      cardType: 'Visa Platinum',
      scenarioName: 'Partial Score: New Device Only (+20 pts)',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Dual-Rule Scenario: Travel Anomaly (+40 pts - Device + Location)
   * Customer in Singapore using new hotel tablet, normal spend ₹3,600 at Starbucks.
   * Rules 2 & 3 fire -> Score 40 (MEDIUM / MONITOR).
   */
  generateTravelAnomalyTransaction() {
    txnSequence++;
    return {
      transactionId: `TX-TRAVEL-${txnSequence}`,
      customerId: 'CUST-8021',
      customerName: 'Ramesh Kumar',
      customerBaseline: 3200,
      amount: 3600,
      currency: 'INR',
      deviceId: 'D-SINGAPORE-01',
      deviceOs: 'Android 15 (Samsung Tab)',
      location: 'Singapore',
      homeLocation: 'Chennai, India',
      isLocationAnomalous: true,
      ipAddress: '202.166.44.12',
      merchant: {
        id: 'M-STARBUCKS',
        name: 'Starbucks Coffee',
        category: 'Dining'
      },
      isNewMerchant: false,
      isHighRiskMerchant: false,
      velocity: 1,
      networkRiskSignal: false,
      cardLast4: '4412',
      cardType: 'Visa Platinum',
      scenarioName: 'Travel Anomaly: Device + Location (+40 pts, MONITOR)',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calibrated random stream generator:
   * ~90% Normal (0 pts, Low / Allow)
   * ~5% Medium (31-50 pts, Medium / Monitor)
   * ~3% High (60-70 pts, High / Verify)
   * ~2% Critical (80-100 pts, Critical / Block)
   * Net Alert Rate in Medium/High/Critical: ~10% (Target: 5-15%)
   */
  generateRandomTransaction(customerList = []) {
    txnSequence++;
    const roll = Math.random();

    const customer = customerList.length > 0
      ? customerList[Math.floor(Math.random() * customerList.length)]
      : {
          customerId: 'CUST-8021',
          name: 'Ramesh Kumar',
          homeLocation: 'Chennai, India',
          baselineAmount: 3200,
          knownDevices: ['D101', 'D102'],
          frequentMerchants: ['Swiggy', 'Amazon IN', 'Apollo Pharmacy', 'Indian Oil', 'Flipkart']
        };

    const baseline = customer.baselineAmount || 3200;
    const knownDevices = customer.knownDevices || ['D101', 'D102'];
    const homeLoc = customer.homeLocation || 'Chennai, India';

    // 1. Normal Transaction (90% probability: 0 pts, LOW / ALLOW)
    if (roll < 0.90) {
      const merchant = NORMAL_MERCHANTS[Math.floor(Math.random() * NORMAL_MERCHANTS.length)];
      const amountVariation = 0.5 + Math.random() * 0.7; // 0.5x to 1.2x baseline
      const amount = Math.round((baseline * amountVariation) / 10) * 10;
      const deviceId = knownDevices[Math.floor(Math.random() * knownDevices.length)] || 'D101';

      return {
        transactionId: `TX-LIVE-${txnSequence}`,
        customerId: customer.customerId,
        customerName: customer.name,
        customerBaseline: baseline,
        amount: Math.max(150, amount),
        currency: 'INR',
        deviceId,
        deviceOs: deviceId.startsWith('D1') ? 'iOS 18.1 (iPhone 14)' : 'Android 15 (Pixel 8)',
        location: homeLoc,
        homeLocation: homeLoc,
        isLocationAnomalous: false,
        ipAddress: `103.21.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}`,
        merchant,
        isNewMerchant: false,
        isHighRiskMerchant: false,
        velocity: 1,
        networkRiskSignal: false,
        cardLast4: '4412',
        cardType: 'Visa Platinum',
        timestamp: new Date().toISOString()
      };
    }

    // 2. Medium Anomaly (5% probability: Travel / New Device + Location -> Score 40 pts, MEDIUM / MONITOR)
    if (roll < 0.95) {
      const merchant = NORMAL_MERCHANTS[Math.floor(Math.random() * NORMAL_MERCHANTS.length)];
      const otherCities = ['Mumbai, India', 'Bengaluru, India', 'Hyderabad, India'];
      const location = otherCities[Math.floor(Math.random() * otherCities.length)];
      const amount = Math.round(baseline * (1.2 + Math.random() * 0.8));
      const newDeviceId = `D-NEW-${Math.floor(100 + Math.random() * 900)}`;

      return {
        transactionId: `TX-LIVE-${txnSequence}`,
        customerId: customer.customerId,
        customerName: customer.name,
        customerBaseline: baseline,
        amount,
        currency: 'INR',
        deviceId: newDeviceId,
        deviceOs: 'Android 15 (Pixel 8)',
        location,
        homeLocation: homeLoc,
        isLocationAnomalous: true,
        ipAddress: `49.36.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}`,
        merchant,
        isNewMerchant: false,
        isHighRiskMerchant: false,
        velocity: 1,
        networkRiskSignal: false,
        cardLast4: '4412',
        cardType: 'Visa Platinum',
        timestamp: new Date().toISOString()
      };
    }

    // 3. High Risk Anomaly (3% probability: Amount 3.5x + New Device + Location Jump -> Score 60 pts, HIGH / VERIFY)
    if (roll < 0.98) {
      const merchant = NORMAL_MERCHANTS[Math.floor(Math.random() * NORMAL_MERCHANTS.length)];
      const foreignCities = ['Singapore', 'Kuala Lumpur, Malaysia', 'London, UK'];
      const location = foreignCities[Math.floor(Math.random() * foreignCities.length)];
      const amount = Math.round(baseline * (3.5 + Math.random() * 1.5));
      const newDeviceId = `D-OVERSEAS-${Math.floor(100 + Math.random() * 900)}`;

      return {
        transactionId: `TX-LIVE-${txnSequence}`,
        customerId: customer.customerId,
        customerName: customer.name,
        customerBaseline: baseline,
        amount,
        currency: 'INR',
        deviceId: newDeviceId,
        deviceOs: 'Android 15 (OnePlus 12)',
        location,
        homeLocation: homeLoc,
        isLocationAnomalous: true,
        ipAddress: `117.200.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}`,
        merchant,
        isNewMerchant: true,
        isHighRiskMerchant: false,
        velocity: 2,
        networkRiskSignal: false,
        cardLast4: '4412',
        cardType: 'Visa Platinum',
        timestamp: new Date().toISOString()
      };
    }

    // 4. Critical Multi-Vector Attack (2% probability: All Rules / Dubai Syndicate -> Score 100 pts, CRITICAL / BLOCK)
    const highRiskMerchant = HIGH_RISK_MERCHANTS[Math.floor(Math.random() * HIGH_RISK_MERCHANTS.length)];
    const foreignCities = ['Dubai, UAE', 'Zurich, Switzerland', 'Nicosia, Cyprus'];
    const location = foreignCities[Math.floor(Math.random() * foreignCities.length)];
    const amount = Math.round(baseline * (12 + Math.random() * 18));
    const rogueDeviceId = 'D999';

    return {
      transactionId: `TX-LIVE-${txnSequence}`,
      customerId: customer.customerId,
      customerName: customer.name,
      customerBaseline: baseline,
      amount,
      currency: 'INR',
      deviceId: rogueDeviceId,
      deviceOs: 'Kali Linux / Automated Script',
      location,
      homeLocation: homeLoc,
      isLocationAnomalous: true,
      ipAddress: `185.220.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}`,
      merchant: highRiskMerchant,
      isNewMerchant: true,
      isHighRiskMerchant: true,
      velocity: 4,
      networkRiskSignal: true,
      cardLast4: '4412',
      cardType: 'Visa Platinum',
      timestamp: new Date().toISOString()
    };
  }
}

export const transactionGenerator = new TransactionGenerator();
