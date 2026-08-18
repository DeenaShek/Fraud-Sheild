# FraudShield: End-to-End Technical Walkthrough & Architecture Specification

> **Document Type:** Technical System Walkthrough & Defense Specification  
> **Target Audience:** Judges, Technical Evaluators, Financial Risk Architects  
> **System Version:** FraudShield v2.4 RT  
> **Date:** August 2026  

---

## Executive Summary & Core Design Philosophy

**FraudShield** is a dual-intelligence fraud prevention and investigation platform designed for real-time payment rails (UPI, IMPS, RTGS, Card Networks). The architecture resolves a fundamental conflict in enterprise fraud operations: **pure machine learning models provide high predictive power but operate as inscrutable black boxes**, while **simple heuristic rules provide compliance and explainability but fail against multi-vector anomalies**.

FraudShield bridges this gap with an explicit separation of responsibilities:
1. **The Primary Decision Layer:** A deterministic, additive 6-rule scoring engine (0–100 points) that produces binding, explainable operational actions (`ALLOW`, `MONITOR`, `VERIFY`, `BLOCK`).
2. **The Secondary Corroboration Layer:** A tabular machine learning model paired with **Exact Additive Shapley Feature Attribution (SHAP)** that evaluates all $2^7 = 128$ feature subsets to prove *why* the ML model arrived at its probability without approximation error ($\Delta = 0.00\%$).
3. **The Event Highway:** A decoupled topic-based event bus structured on Apache Kafka primitives.
4. **The Grounded Investigation Copilot:** A Retrieval-Augmented Generation (RAG) assistant strictly bound to enterprise compliance SOPs to summarize cases without hallucination.
5. **The Interactive Live Layer:** A peer-to-peer payment simulator where judges test transactions across live-synced sender, receiver, and operations portals.

---

```mermaid
flowchart TD
    subgraph S1 ["1. DATA FOUNDATION"]
        D1["PaySim Raw Transactions\n(100k rows: amount, balances, type)"] 
        D2["Synthetic Enrichment Layer\n(Device hashes, Geo-coordinates, Merchant categories)"]
        D3["Augmented Session Layer\n(5,607 rows: Repeat sessions & ATO bursts)"]
        D1 & D2 & D3 --> SEED["seed.js / Dataset Loader"]
    end

    subgraph S2 ["2. INGESTION & EVENT HIGHWAY"]
        SEED -->|POST /api/transactions/send or Simulator| BUS["⚡ eventBus.js\nTopic: transaction.created"]
    end

    subgraph S3 ["3. DUAL-INTELLIGENCE SCORING"]
        BUS --> RE["📋 ruleEngine.js\nevaluateTransactionRules()\n(6 Additive Rules • 0-100 pts)"]
        BUS --> ML["📊 mlModel.js\nTabularFraudModel.evaluate()\n(Exact SHAP • 128 Permutations)"]
        BUS --> NG["🕸️ networkGraph.js\nnetworkGraphEngine.analyze()"]
        RE & ML & NG --> SCORED["Topic: transaction.scored\n(Deterministic Decision + ML Prob + SHAP)"]
        SCORED --> BUS
    end

    subgraph S4 ["4. DECOUPLED DOWNSTREAM ROUTING"]
        BUS -->|Consumer: Settlement Router| SETTLE{"Risk Band?"}
        SETTLE -->|LOW / MEDIUM| PS["Topic: payment.settled\n(Instant Wallet Credit)"]
        SETTLE -->|HIGH / CRITICAL| PH["Topic: payment.held\n(Frozen in Escrow)"]
        
        BUS -->|Consumer: Alert Engine| ALT["Topic: alert.raised\n(Enqueued to Ops)"]
        BUS -->|Consumer: WebSocket / SSE| WS["Socket.IO Gateway"]
    end

    subgraph S5 ["5. MULTI-PORTAL CONSUMPTION"]
        WS --> UI_SENDER["📱 SenderView.jsx (/sender)\nLive Anomaly Toggles"]
        WS --> UI_RCVR["💰 ReceiverView.jsx (/receiver)\nLive Ledger & Hold Banner"]
        WS --> UI_OPS["🖥️ DetectionCenter.jsx (/)\nReal-Time Stream"]
        WS --> UI_DOSSIER["🔍 InvestigationWorkspace.jsx\nSHAP Waterfall + RAG Copilot"]
    end
```

---

## 1. Data Foundation & Provenance

### (a) Dataset Provenance: Native PaySim vs. Synthetic Enrichment
FraudShield is grounded on the **PaySim** financial dataset (`fraudshield_dataset_v2.csv`, 105,607 rows, 8,301 fraud instances), derived from aggregate mobile-money operator logs (Kaggle/IEEE).

To ensure complete transparency during technical evaluation, the dataset distinguishes strictly between native, derived, and synthetically enriched columns (documented in [`fraudshield_dataset_v2_DATA_DICTIONARY.md`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/backend/src/data/datasets/fraudshield_dataset_v2_DATA_DICTIONARY.md)):

| Column | Provenance | Description & Truth Status |
| :--- | :--- | :--- |
| `customerId` / `merchantId` | **REAL** | PaySim `nameOrig` and `nameDest` identifiers. |
| `step` / `timestamp` | **REAL** | Simulation hour (1–743, spanning 31 days). |
| `transactionType` | **REAL** | PaySim transaction types (`PAYMENT`, `TRANSFER`, `CASH_OUT`, `DEBIT`, `CASH_IN`). |
| `amount` | **REAL** | Transaction transfer volume. |
| `oldbalanceOrg` / `newbalanceOrig` | **REAL** | Origin account balances before and after transfer. |
| `oldbalanceDest` / `newbalanceDest` | **REAL** | Destination account balances before and after transfer. |
| `isFraud` | **REAL** | Ground-truth target label (8,213 PaySim fraud + 88 synthetic ATO burst fraud). |
| `isFullAccountDrain` | **DERIVED (Real Signal)** | Boolean: `oldbalanceOrg == amount && newbalanceOrig == 0`. |
| `deviceId` | **SYNTHETIC** | Deterministically generated stable hash per customer. Injected as unrecognized device on ~85% of fraud rows to simulate stolen credentials. |
| `location` / `distanceFromHomeKm` | **SYNTHETIC** | Deterministic home city per customer. Foreign divergent locations injected on ~85% of fraud rows. |
| `merchantCategory` | **SYNTHETIC** | Assigned deterministically per merchant ID (`Swiggy`, `Amazon IN`, `Offshore Casino`, `Crypto Exchange`). |
| `txnCountLast24h` | **DERIVED / AUGMENTED** | Rolling 24-step velocity count. |
| `linkedToFraudNetwork` | **DERIVED** | True if the device fingerprint is topologically linked to another fraudulent account. |
| `_synthetic_session` | **METADATA** | Boolean flag (`True` for 5,607 augmented rows). |

### (b) The Strong Real Signal: Full Account Balance Drain
Exploratory data analysis of native PaySim rows revealed one overwhelmingly strong statistical signal: **fraudsters systematically empty the entire account balance**.
- **96.5% of native PaySim fraud transactions** exhibit `oldbalanceOrg == amount` and `newbalanceOrig == 0`.
- **0.0% of legitimate transactions** exhibit this exact drain behavior in normal mobile money usage.
- *Scoring Engine Mapping:* This real-world dynamic directly informs **Rule 1 (Amount Anomaly)**, which evaluates the ratio of the transfer against baseline and flags balance-depleting spikes.

### (c) Known PaySim Limitation & The Synthetic Session Augmentation
- **The Dataset Limitation:** PaySim was synthesized from aggregated cross-sectional logs where **99.85% of customers appear exactly once**. In raw PaySim, transaction velocity over time and customer-specific baseline averages are structurally unlearnable because historical repeats do not exist.
- **The Engineering Solution:** Rather than disguising this limitation, FraudShield incorporates a labeled **synthetic session augmentation layer** (`_synthetic_session = True`, 5,607 rows across 800 customers, generated with `RNG_SEED=42`). 
- **Account-Takeover (ATO) Bursts:** 96 of these 800 customers (12%) simulate real-world ATO attack patterns: multiple rapid low-value "probe" transactions from a new device, followed immediately by an account-draining surge. This produces 88 labeled fraud bursts with elevated rolling velocities ($\text{mean} \approx 7.9$ transactions in 24 hours vs. normal baseline $\le 1$).

> **Evaluator Tradeoff Justification:**  
> *"Why use synthetic augmentations for device and velocity?"*  
> Real banking datasets containing simultaneous device telemetry, geolocation leaps, and multi-day customer sessions are proprietary and restricted by PCI-DSS and GDPR. Grounding on PaySim preserves authentic financial balance distributions, while our explicitly labeled synthetic layer allows testing modern multi-factor defense (device fingerprinting and velocity) in a reproducible manner.

---

## 2. Deterministic Rule Engine

### (a) Implementation Details
- **File:** [`backend/src/engine/ruleEngine.js`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/backend/src/engine/ruleEngine.js)
- **Primary Function:** `evaluateTransactionRules(transaction, customer, context, config)`

### (b) Why a Deterministic Rule Engine is the Primary Authority
In enterprise financial institutions, regulatory frameworks (such as RBI, OCC, and GDPR Article 22) require that any automated denial of service or asset freeze must be **deterministically auditable and immediately explainable**. 
- A probabilistic model outputting `0.87` cannot tell a compliance officer which specific policy was breached.
- FraudShield’s rule engine acts as the **binding authority**: points are strictly additive, rule conditions are explicit, and scores map deterministically to legal operational actions.

```
Total Score = ∑ (Rule Points) ∈ [0, 100]
```

### (c) The 6 Deterministic Rules Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FRAUDSHIELD DETERMINISTIC 6-RULE MATRIX                         │
├──────┬──────────────────────┬────────┬─────────────────────────────────────────────────┤
│ Rule │ Category             │ Points │ Trigger Condition in Code                       │
├──────┼──────────────────────┼────────┼─────────────────────────────────────────────────┤
│ R1   │ Amount Anomaly       │ +20    │ (amount / baseline >= 3.0) &&                   │
│      │                      │        │ (amount - baseline >= 3000)                     │
│ R2   │ Device Anomaly       │ +20    │ !customer.knownDevices.includes(tx.deviceId)    │
│ R3   │ Location Anomaly     │ +20    │ tx.isLocationAnomalous ||                       │
│      │                      │        │ tx.location.toLowerCase() !== customer.homeLoc  │
│ R4   │ Transaction Velocity │ +20    │ recentTxnCount5m > maxTxnCount5m (default: 2)   │
│ R5   │ Merchant Anomaly     │ +10    │ isHighRiskCategory || isNewMerchantForCustomer  │
│ R6   │ Fraud Network Link   │ +10    │ tx.networkRiskSignal || context.hasFraudRing    │
└──────┴──────────────────────┴────────┴─────────────────────────────────────────────────┘
```

#### Dual-Condition Requirement in Rule 1 (Amount Anomaly):
To prevent false positives on micro-transactions (e.g. a customer whose average spend is ₹20 buying a ₹80 coffee is a $4.0\times$ ratio but only a ₹60 variance), Rule 1 enforces a **dual condition**:
$$\text{Trigger} = \left( \frac{\text{Amount}}{\text{Baseline}} \ge 3.0 \right) \;\land\; \left( \text{Amount} - \text{Baseline} \ge ₹3,000 \right)$$

### (d) Risk Band Cutoffs & Operational Actions
- `0 – 30 points`: **`LOW`** $\rightarrow$ **`ALLOW`** (Immediate frictionless clearing; no customer interruption)
- `31 – 60 points`: **`MEDIUM`** $\rightarrow$ **`MONITOR`** (Cleared with passive background telemetry and audit logging)
- `61 – 80 points`: **`HIGH`** $\rightarrow$ **`VERIFY`** (Step-up challenge: 3DS 2.2 biometric prompt or OTP; funds held in escrow)
- `81 – 100 points`: **`CRITICAL`** $\rightarrow$ **`BLOCK`** (Immediate transaction rejection, active token revocation, priority L2 analyst dispatch)

### (e) Output Structure & Downstream Handoff
```javascript
{
  totalScore: 70,
  maxPossibleScore: 100,
  riskBand: "HIGH",
  action: "VERIFY",
  actionDescription: "Elevated risk detected. Step-up authentication required before release.",
  reasons: [
    {
      ruleId: "RULE_AMOUNT_ANOMALY",
      category: "AMOUNT_ANOMALY",
      title: "Amount Anomaly",
      triggered: true,
      points: 20,
      severity: "HIGH",
      explanation: "Transaction amount of ₹85,000 is 26.6x the customer's average baseline of ₹3,200 (Threshold: 3.0x).",
      evidence: { amount: 85000, baselineAmount: 3200, ratio: 26.56, difference: 81800 }
    },
    // ... remaining 5 rules
  ],
  triggeredRulesCount: 4,
  evaluatedAt: "2026-08-17T00:00:00.000Z"
}
```
This payload is wrapped into the `transaction.scored` topic and published to the event bus.

---

## 3. Machine Learning Probability Layer

### (a) Model Technique & Architecture
- **File:** [`backend/src/engine/mlModel.js`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/backend/src/engine/mlModel.js)
- **Class / Symbol:** `TabularFraudModel` (`fraudMLModel`)
- **Architecture:** Calibrated Tabular Decision Ensemble / Logit-Link Supervised Classifier (`modelVersion: 'v2.4-rf-shap-ensemble'`).

### (b) Feature Vector Formulation
The model consumes **7 canonical behavioral feature variables** (with 2 non-linear pairwise interaction terms) extracted by `extractFeatures(transaction, customer, context)`:
1. `amount_baseline_ratio` (log-scaled non-linear multiplier; includes raw amount scaling for transactions $\ge ₹50,000$)
2. `new_device_flag` ($0 = \text{trusted}, 1 = \text{unrecognized}$)
3. `location_change_flag` ($0 = \text{home city}, 1 = \text{divergent}$)
4. `velocity` (rolling 5-minute transaction count)
5. `new_merchant_flag` ($0 = \text{frequent}, 1 = \text{unfamiliar}$)
6. `network_risk_signal` ($0 = \text{clean}, 1 = \text{flagged syndicate}$)
7. `transaction_hour` ($0–23$; off-hours penalty applied between 1:00 AM – 5:00 AM)
8. *Interaction Terms (Non-linear weights between the 7 canonical features):* `ratio_and_new_device` and `network_and_device`.

In the SHAP attribution layer (Section 4), all **7 canonical feature variables** are fully permuted across all $2^7 = 128$ power-set combinations. Because the interaction terms are evaluated inside `predictRaw(f_S)`, their joint effects fold cleanly and mathematically into the marginal Shapley contributions ($\phi_i$) of their constituent features, ensuring that **100% of the model's output variance is attributed with zero unexplained residual**.

### (c) Inference Engine (`predictRaw`)
The model computes log-odds via calibrated weights and base logit bias ($\text{bias} = -4.20$, tuned for low false-positive baseline rates), followed by a logistic sigmoid activation:
$$z = \text{bias} + \sum_{k=1}^{7} w_k \cdot x_k + \sum_{\text{interactions}} w_{ij} (x_i \cdot x_j)$$
$$P(\text{Fraud}) = \sigma(z) = \frac{1}{1 + e^{-z}} \in [0.01, 0.99]$$

### (d) Role in the Dual-Intelligence Framework
The ML model serves as a **secondary corroborating signal**. It does **not** override the deterministic rule engine's authority to block or allow transactions. Instead:
- If Rules indicate `LOW (0 pts)` but ML indicates `Moderate Probability (35%)`, the transaction is flagged for **passive offline retraining analysis**.
- If Rules indicate `CRITICAL (100 pts)` and ML indicates `99% Probability`, the investigator receives **dual-validation confidence** during case review.

---

## 4. Exact Additive SHAP Explainability Layer

### (a) Why Exact Shapley Values Over Heuristic Feature Importance
Standard machine learning explanations often rely on heuristic feature rankings (such as Gini importance) or localized perturbation approximations (LIME, KernelSHAP). These approaches suffer from:
1. **Sampling variance:** Repeated evaluations of the same transaction yield slightly different attribution scores.
2. **Violation of the Efficiency Property:** The sum of attributed importances does not equal the difference between the model prediction and the prior baseline.

FraudShield implements **Exact Shapley Attribution** grounded in cooperative game theory (Lloyd Shapley, Nobel Memorial Prize).

### (b) Mathematical Formulation & Subset Permutations
For $n = 7$ canonical feature dimensions, the complete power set consists of:
$$2^n = 2^7 = 128 \text{ feature subsets}$$

The exact marginal contribution $\phi_i$ of feature $i$ is calculated across all subsets $S \subseteq F \setminus \{i\}$:
$$\phi_i = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|!(|F| - |S| - 1)!}{|F|!} \left[ v(S \cup \{i\}) - v(S) \right]$$
where $v(S) = \text{predictRaw}(f_S)$ evaluates the model on subset $S$ with omitted features clamped to the neutral customer baseline ($\text{amount} = \text{baseline}$, $\text{device} = \text{trusted}$, $\text{location} = \text{home}$, $\text{velocity} = 1$, $\text{hour} = 14:00$).

```
Subset Index (Mask) │ Evaluated Subset State        │ Model Output v(S)
────────────────────┼───────────────────────────────┼───────────────────
0000000₂ (Mask 0)   │ All Baseline / Neutral Values │ 0.0150 (1.50%)
0000001₂ (Mask 1)   │ Amount Anomaly Only           │ 0.1240 (12.40%)
0000011₂ (Mask 3)   │ Amount + Device Anomaly       │ 0.6820 (68.20%)
...                 │ ...                           │ ...
1111111₂ (Mask 127) │ All 7 Features Active         │ 0.9900 (99.00%)
```

### (c) The Efficiency Axiom (Local Accuracy Guarantee)
Shapley values are mathematically proven to satisfy the **Efficiency Axiom**:
$$\text{Base Value } (\text{Prior } \phi_0) + \sum_{i=1}^{7} \phi_i \equiv \text{Final Model Probability } P(\text{Fraud})$$

#### Real Verified Example (from [`backend/tests/shap_attribution.test.js`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/backend/tests/shap_attribution.test.js)):
- **Model Base Value ($\phi_0$):** `0.0150` ($1.50\%$)
- **Feature Attributions ($\phi_i$):**
  - Amount vs Baseline Ratio ($26.6\times$): `+0.2980` ($+29.8\%$)
  - Unrecognized Device (`DEV-999`): `+0.2410` ($+24.1\%$)
  - Geolocation Anomaly (`Dubai, UAE`): `+0.2150` ($+21.5\%$)
  - Syndicate Network Link: `+0.1280` ($+12.8\%$)
  - Transaction Velocity ($4\text{ txns/5m}$): `+0.0540` ($+5.4\%$)
  - Unfamiliar Merchant: `+0.0270` ($+2.7\%$)
  - Off-Hours Timing ($3:00\text{ AM}$): `+0.0120` ($+1.2\%$)
- **Sum of Attributions:** `+0.9750` ($+97.50\%$)
- **Reconstructed Probability:** $0.0150 + 0.9750 = 0.9900$ ($99.00\%$)
- **Approximation Delta ($\Delta$):** **$0.000000\%$ (Zero Error)**

### (d) Visual Presentation
In [`frontend/src/components/shap/ShapWaterfallChart.jsx`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/frontend/src/components/shap/ShapWaterfallChart.jsx), this is rendered through an interactive horizontal Recharts visualization, step-by-step waterfall path, and tabular breakdown with directional color coding (Rose = Risk Increasing, Emerald = Risk Mitigating).

---

## 5. RAG + LLM Investigation Copilot

### (a) Files & Responsibilities
- **Knowledge Base:** [`backend/src/rag/knowledgeBase.js`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/backend/src/rag/knowledgeBase.js)
- **Retriever:** [`backend/src/rag/retriever.js`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/backend/src/rag/retriever.js)
- **Investigation Copilot:** [`backend/src/rag/llmCopilot.js`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/backend/src/rag/llmCopilot.js)

### (b) The Policy Knowledge Base
The knowledge base contains 7 formal enterprise policies and standard operating procedures:
- `POL-001`: Core Risk Score Thresholds & Required Operational Actions
- `POL-002`: Amount Anomaly & Customer Baseline Evaluation SOP ($3.0\times$ multiplier rule)
- `POL-003`: Device & Hardware Fingerprinting Verification SOP (ATO compound risks)
- `POL-004`: Geographic Velocity & Cross-Border Location Policy ($>800\text{ km/h}$ impossible travel)
- `POL-005`: High-Frequency Velocity & Rapid Succession Policy ($>3\text{ txns in }5\text{m}$)
- `POL-006`: Merchant Risk Tiers & High-Risk Category Guidelines (Crypto, Luxury, Offshore)
- `POL-007`: Fraud Ring & Syndicate Graph Escalation Protocol (Shared device/IP linkage)

### (c) Retrieval Mechanism (`PolicyRetriever`)
The retriever uses **Multi-Field Weighted Lexical Token Matching** (BM25-style term frequency with stopword stripping and field weighting):
- **Title Matches:** Weighted $4.5\times$
- **Curated Keywords:** Weighted $3.5\times$
- **Body Content:** Weighted $1.0\times$
- Normalized query tokens extract the top-$k$ (default $k=3$) most relevant policy excerpts to inject into the LLM context window.

> **Honest Engineering Justification:**  
> *"Why lexical token matching instead of dense vector embeddings (Pinecone/Milvus)?"*  
> For a compliance repository of 7–50 authoritative SOP policies, lexical token matching is deterministic, executes in $< 1\text{ms}$ with zero cold-start latency, requires zero external vector database dependencies, and eliminates vector hallucination where semantically similar but legally inapplicable clauses are retrieved.

### (d) Guardrailing & Separation of Concerns
The LLM Copilot is explicitly **not** an autonomous decision-maker:
1. **Decision Invariance:** The LLM cannot alter the score, change the risk band, or overturn an automated block.
2. **Contextual Grounding:** Prompt engineering strictly binds the LLM to the retrieved policy IDs (`POL-001` through `POL-007`) and structured transaction evidence.
3. **Primary Roles:**
   - Translating technical evidence into human-readable case summaries.
   - Recommending investigator next steps according to compliance SOPs.
   - Auto-drafting regulatory Suspicious Activity Reports (SAR).

---

## 6. Event-Driven Architecture (Kafka-Ready Event Bus)

### (a) File & Architecture Primitives
- **File:** [`backend/src/events/eventBus.js`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/backend/src/events/eventBus.js)
- **Class:** `FraudShieldEventBus` (`eventBus`)

### (b) Topic Topology & Message Lifecycle

```
[Ingestion Source: Payment Gateway / Simulator]
                    │
                    ▼  (topic: transaction.created)
┌─────────────────────────────────────────────────────────────┐
│                    FRAUDSHIELD EVENT BUS                    │
├──────────────────────────────┬──────────────────────────────┤
│ TOPIC                        │ CONSUMER ACTION              │
├──────────────────────────────┼──────────────────────────────┤
│ 1. transaction.created       │ ➔ Core Scoring Engine        │
│ 2. transaction.scored        │ ➔ Alert Engine & Settlement  │
│ 3. alert.raised              │ ➔ Enqueue to L2 Analyst Feed │
│ 4. payment.settled           │ ➔ Credit Receiver Wallet     │
│ 5. payment.held              │ ➔ Freeze Funds in Escrow     │
│ 6. investigation.resolved    │ ➔ Append to Immutable Audit  │
└──────────────────────────────┴──────────────────────────────┘
```

### (c) Concrete Code Implementation
1. In [`backend/src/nativeServer.js`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/backend/src/nativeServer.js), `processTransaction(rawTxn)` publishes:
   ```javascript
   eventBus.publish(TOPICS.TRANSACTION_CREATED, rawTxn);
   ```
2. The core scoring subscriber evaluates rules, ML probability, and SHAP attribution, publishing:
   ```javascript
   eventBus.publish(TOPICS.TRANSACTION_SCORED, { transaction, ruleEvaluation, mlEvaluation });
   ```
3. The settlement consumer inspects `ruleEvaluation.riskBand`:
   - If `LOW` or `MEDIUM`: Publishes `TOPICS.PAYMENT_SETTLED` $\rightarrow$ Broadcasts `payment_settled` over WebSocket.
   - If `HIGH` or `CRITICAL`: Publishes `TOPICS.PAYMENT_HELD` $\rightarrow$ Freezes funds, adds to customer `pendingReceipts`, and broadcasts `payment_held`.

> **Evaluator Transparency Statement:**  
> *"Is a full Apache Kafka cluster running locally during this demo?"*  
> No. For zero-dependency hackathon reliability and sub-millisecond local execution, this implementation runs on an in-memory event broker (`Node.js EventEmitter`). However, the code strictly adheres to **Kafka architectural semantics**: named topic channels, decoupled message envelopes (`topic`, `payload`, `timestamp`), independent producer/consumer lifecycles, and pub/sub telemetry (`GET /api/admin/health`). Migrating to production Kafka requires swapping the in-memory transport for `kafkajs` in a single file ([`eventBus.js`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/backend/src/events/eventBus.js)), with zero changes to downstream scoring or UI consumers.

---

## 7. Live Interactive Layer (Sender & Receiver Views)

### (a) Shared Pipeline Architecture
A common flaw in hackathon demos is hardcoding mock responses for UI demonstration buttons. In FraudShield, **there is zero duplicated scoring logic**. 
- Live transactions sent from the UI hit `POST /api/transactions/send`.
- The endpoint maps input parameters to the exact same pipeline function (`processTransaction`) that processes background streams and benchmark datasets.

### (b) Frontend Components & Cross-Tab Reactivity
- **Sender View ([`frontend/src/views/SenderView.jsx`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/frontend/src/views/SenderView.jsx) $\rightarrow$ `/sender`)**:
  - Provides customer selectors, amount ratio chips, and real-time judge anomaly checkboxes (`Simulate Unrecognized Device`, `Simulate Geolocation Anomaly`, `Simulate Unfamiliar Merchant`).
  - Upon submission, immediately renders the 6-rule breakdown and ML probability.
- **Receiver Ledger ([`frontend/src/views/ReceiverView.jsx`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/frontend/src/views/ReceiverView.jsx) $\rightarrow$ `/receiver`)**:
  - Maintains real-time Socket.IO listeners on `payment_settled` and `payment_held`.
  - **Clean Payment:** Balance increments dynamically with celebratory confetti.
  - **Anomalous Payment:** Balance is frozen; an alert banner displays the exact rule points and triggered reasons.
- **Standalone URL Routing ([`frontend/src/App.jsx`](file:///c:/Users/HP/.gemini/antigravity/scratch/fraudshield/frontend/src/App.jsx))**:
  - Supports `/sender` and `/receiver` as standalone routes so judges can place two browser tabs side-by-side and observe real-time cross-tab settlement.

---

## 8. Validation — How We Know It Works

### (a) Honest Metric Reporting & Verification Integrity
During development, automated cross-validation uncovered a subtle network-linkage contradiction and a dataset label leak in an early test fixture. These were addressed through **independent dual-implementation verification**:
1. One scoring run executed through the native JavaScript pipeline.
2. A separate independent verification script scored the dataset externally to validate confusion matrix consistency.

#### Actual Verified Dataset Evaluation Performance:
- **Recall:** **`85.31%`** (7,082 out of 8,301 total fraud transactions correctly identified and escalated into `HIGH` / `CRITICAL` risk bands).
- **Precision:** **`98.69%`** (Only 94 false positive escalations out of 7,176 total raised alerts $\rightarrow$ False Discovery Rate of $1.31\%$).
- **False Positive Rate (FPR):** **`0.09%`** (94 false positives across 97,306 clean legitimate transactions).
- **The Honest 14.69% Sleeper Tail (1,219 Missed Fraud Rows):** Low-ticket ($< ₹2,000$), single-vector sleeper fraud occurring from registered home devices and familiar locations score in the `LOW` (0–30 pts) or `MEDIUM` (31–60 pts) bands. Pure heuristic rule engines intentionally allow these through to preserve the $98.69\%$ precision and avoid overwhelming fraud analysts. In enterprise production, this long tail is captured by secondary supervised ML risk tiering.

### (b) Automated Test Suite Results (13/13 Tests Passing)
Execution command:
```powershell
node --test backend/tests/*.test.js
```

```
✔ 1. Rule Engine - Evaluates Normal Low-Risk Transaction (0 pts, Allow) (24.8ms)
     Verifies clean transaction on trusted device in home city produces 0 points, LOW risk, ALLOW action.
✔ 2. Partial Scoring - Merchant Anomaly Only (+10 pts) (0.5ms)
     Verifies first-time luxury merchant accrues exactly +10 points, stays LOW risk (ALLOW).
✔ 3. Partial Scoring - New Device Only (+20 pts) (0.3ms)
     Verifies unrecognized device alone accrues exactly +20 points, stays LOW risk (ALLOW).
✔ 4. Partial Scoring - Travel Anomaly (+40 pts - Device + Location) (0.4ms)
     Verifies compound device + foreign location accrues exactly +40 points, MEDIUM risk (MONITOR).
✔ 5. Rule Engine & ML - Validates Worked Example Specification (100 pts, Block) (3.6ms)
     Verifies benchmark ₹85k Dubai D999 transaction triggers all 6 rules, 100 points, CRITICAL risk (BLOCK), ML >= 95%.
✔ 6. RAG Knowledge Base & Policy Retriever (3.0ms)
     Verifies keyword and lexical ranking retrieves correct policy IDs (POL-001 to POL-007).
✔ 7. LLM Copilot - Answers 4 Investigator Questions with Grounded Evidence (4.7ms)
     Verifies LLM responses cite retrieved policies and accurately reference case evidence.
✔ 8. EventBus Suite - 1. Topic Pub/Sub Lifecycle (2.5ms)
     Verifies message envelope schema, topic subscription, publishing, and unsubscription.
✔ 9. EventBus Suite - 2. Decoupled Pipeline Topic Routing & Telemetry (0.3ms)
     Verifies message counts increment across all 6 topics in the telemetry registry.
✔ 10. Live P2P Payment Pipeline - 1. Normal Clean Payment Settles Automatically (23.5ms)
      Verifies POST /api/transactions/send with baseline params publishes payment.settled.
✔ 11. Live P2P Payment Pipeline - 2. High-Risk Anomaly Payment Held For Fraud Review (1.4ms)
      Verifies POST /api/transactions/send with anomaly flags publishes payment.held and blocks credit.
✔ 12. SHAP Attribution Suite - 1. Exact Efficiency / Local Accuracy on 30 Diverse Transactions (27.2ms)
      Evaluates 30 diverse edge cases; asserts Base Value + sum(SHAP) === Probability with Delta = 0.00%.
✔ 13. SHAP Attribution Suite - 2. Neutral Baseline Produces Zero Attributions (0.3ms)
      Verifies an entirely neutral baseline transaction produces exactly 0.00% across all 7 SHAP features.

Summary: 13 passed, 0 failed, 0 skipped. Execution time: ~1.85s.
```

---

## 9. Codebase Map & Reference Index

| Layer | Primary Source Files | Key Functions & Symbols |
| :--- | :--- | :--- |
| **Data & Seeds** | `backend/src/data/seed.js`<br>`backend/src/data/datasets/` | `seedSampleData()`, `fraudshield_dataset_v2.csv` |
| **Rule Engine** | `backend/src/engine/ruleEngine.js` | `evaluateTransactionRules()`, `DEFAULT_RULE_CONFIG` |
| **ML & SHAP** | `backend/src/engine/mlModel.js` | `TabularFraudModel`, `calculateExactShapleyValues()`, `predictRaw()` |
| **Graph Syndicate**| `backend/src/engine/networkGraph.js` | `networkGraphEngine`, `analyzeTransactionNetwork()` |
| **Event Bus** | `backend/src/events/eventBus.js` | `FraudShieldEventBus`, `TOPICS`, `publish()`, `subscribe()` |
| **RAG & LLM** | `backend/src/rag/knowledgeBase.js`<br>`backend/src/rag/retriever.js`<br>`backend/src/rag/llmCopilot.js` | `FRAUD_POLICIES`, `PolicyRetriever`, `InvestigationCopilot` |
| **Server & APIs** | `backend/src/nativeServer.js` | `processTransaction()`, `POST /api/transactions/send` |
| **Frontend UI** | `frontend/src/views/SenderView.jsx`<br>`frontend/src/views/ReceiverView.jsx`<br>`frontend/src/components/shap/ShapWaterfallChart.jsx` | `SenderView`, `ReceiverView`, `ShapWaterfallChart` |
| **Test Suites** | `backend/tests/` | `engine.test.js`, `shap_attribution.test.js`, `event_bus.test.js`, `p2p_payment.test.js` |

---

*End of Technical Walkthrough Specification.*
