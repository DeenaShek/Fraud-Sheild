/**
 * FraudShield Standalone Throughput & Latency Benchmark
 * 
 * Measures:
 * 1. Pure In-Memory Scoring Engine (Rule Engine + Tabular ML + Exact SHAP 128 subsets)
 * 2. End-to-End HTTP API Path (POST /api/transactions/send)
 */

import http from 'node:http';
import { evaluateTransactionRules, DEFAULT_RULE_CONFIG } from '../src/engine/ruleEngine.js';
import { fraudMLModel } from '../src/engine/mlModel.js';
import { transactionGenerator } from '../src/simulator/transactionGenerator.js';

const customers = [
  {
    customerId: 'CUST-8021',
    name: 'Ramesh Kumar',
    homeLocation: 'Chennai, India',
    baselineAmount: 3200,
    knownDevices: ['D101', 'D102'],
    frequentMerchants: ['Swiggy', 'Amazon IN', 'Apollo Pharmacy', 'Indian Oil', 'Flipkart']
  },
  {
    customerId: 'CUST-3310',
    name: 'Ananya Deshmukh',
    homeLocation: 'Mumbai, India',
    baselineAmount: 4500,
    knownDevices: ['D201'],
    frequentMerchants: ['Zomato', 'Uber', 'Myntra']
  }
];

async function runPureScoringBenchmark(iterations = 10000) {
  console.log(`\n================================================================`);
  console.log(`1. BENCHMARK: Pure In-Process Scoring (Rules + ML + Exact SHAP)`);
  console.log(`   Iterations: ${iterations.toLocaleString()} synthetic transactions`);
  console.log(`================================================================`);

  // Pre-generate transactions to isolate compute timing from generation overhead
  const batch = [];
  for (let i = 0; i < iterations; i++) {
    batch.push(transactionGenerator.generateRandomTransaction(customers));
  }

  const startTime = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    const rawTxn = batch[i];
    const customer = customers[i % customers.length];
    const context = {
      knownDevices: customer.knownDevices,
      recentTxnCount5m: rawTxn.velocity || 1,
      hasFraudRingLinks: Boolean(rawTxn.networkRiskSignal),
      linkedSuspiciousAccountsCount: rawTxn.networkRiskSignal ? 3 : 0
    };

    // 1. Deterministic Rule Scorer (6 rules)
    const ruleEval = evaluateTransactionRules(rawTxn, customer, context, DEFAULT_RULE_CONFIG);
    // 2. Tabular ML + 128 Exact Additive Shapley Permutations
    const mlEval = fraudMLModel.evaluate(rawTxn, customer, context);
  }

  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1e6;
  const tps = Math.round((iterations / (durationMs / 1000)));
  const avgLatencyUs = (durationMs * 1000 / iterations).toFixed(1);

  console.log(`   ✓ Completed ${iterations.toLocaleString()} scores in ${durationMs.toFixed(2)} ms`);
  console.log(`   ⚡ Pure Scoring Throughput: ${tps.toLocaleString()} txns/sec`);
  console.log(`   ⏱️  Avg Scoring Latency:    ${avgLatencyUs} µs (${(avgLatencyUs / 1000).toFixed(3)} ms) per txn\n`);

  return { iterations, durationMs, tps, avgLatencyUs };
}

function makeHttpRequest(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/transactions/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runHttpApiBenchmark(requests = 200) {
  console.log(`================================================================`);
  console.log(`2. BENCHMARK: End-to-End HTTP API Path (POST /api/transactions/send)`);
  console.log(`   Requests: ${requests} sequential HTTP transactions over loopback`);
  console.log(`================================================================`);

  // Check if server is running first
  try {
    const healthCheck = await makeHttpRequest({ senderId: 'CUST-8021', receiverId: 'CUST-3310', amount: 3200 });
    if (healthCheck.status !== 200) {
      console.log(`   ⚠️ Backend returned status ${healthCheck.status}. Ensure backend is running on http://localhost:5000.`);
      return null;
    }
  } catch (err) {
    console.log(`   ⚠️ Could not connect to http://localhost:5000: ${err.message}`);
    console.log(`      (Start server with 'node src/nativeServer.js' to run HTTP benchmark).`);
    return null;
  }

  const startTime = process.hrtime.bigint();

  for (let i = 0; i < requests; i++) {
    await makeHttpRequest({
      senderId: 'CUST-8021',
      receiverId: 'CUST-3310',
      amount: 1000 + (i * 25) % 15000,
      simulateNewDevice: i % 10 === 0,
      simulateNewLocation: i % 15 === 0
    });
  }

  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1e6;
  const tps = Math.round((requests / (durationMs / 1000)));
  const avgLatencyMs = (durationMs / requests).toFixed(2);

  console.log(`   ✓ Completed ${requests} full HTTP transactions in ${durationMs.toFixed(2)} ms`);
  console.log(`   ⚡ End-to-End API Throughput: ${tps.toLocaleString()} req/sec`);
  console.log(`   ⏱️  Avg End-to-End Latency:   ${avgLatencyMs} ms per request\n`);

  return { requests, durationMs, tps, avgLatencyMs };
}

async function main() {
  const pureResults = await runPureScoringBenchmark(10000);
  const httpResults = await runHttpApiBenchmark(300);

  console.log(`================================================================`);
  console.log(`📊 BENCHMARK SUMMARY (Single Node.js Process):`);
  console.log(`   • Pure Scoring (Rules + ML + SHAP): ~${pureResults.tps.toLocaleString()} txns/sec (${(pureResults.avgLatencyUs / 1000).toFixed(3)} ms/txn)`);
  if (httpResults) {
    console.log(`   • Full HTTP Pipeline (Socket + EventBus): ~${httpResults.tps.toLocaleString()} req/sec (${httpResults.avgLatencyMs} ms/req)`);
  }
  console.log(`================================================================\n`);
}

main().catch(console.error);
