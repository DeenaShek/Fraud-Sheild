# FraudShield Dataset v2 — Data Dictionary & Provenance

**File:** `fraudshield_dataset_v2.csv`
**Rows:** 105,607 (100,000 from PaySim + 5,607 synthetic repeat-customer session rows)
**Fraud rows:** 8,301 (8,213 original PaySim fraud + 88 synthetic ATO-burst fraud)
**Source:** [PaySim](https://www.kaggle.com/datasets/ealaxi/paysim1) — synthetic mobile-money transaction simulator, Kaggle/IEEE, built from a real African mobile money operator's aggregate statistics.

Every column is tagged so you can answer "is this real or fabricated?" for any field without hesitation.

| Column | Provenance | Description |
|---|---|---|
| `customerId` | **REAL** (PaySim `nameOrig`) | Origin account identifier |
| `step` | **REAL** (PaySim `step`) | Simulation hour, 1–743 (~31 days) |
| `timestamp` | DERIVED (real) | `step` converted to a datetime for display |
| `transactionType` | **REAL** (PaySim `type`) | PAYMENT / TRANSFER / CASH_OUT / CASH_IN / DEBIT. Fraud in PaySim occurs only in TRANSFER/CASH_OUT. |
| `amount` | **REAL** (PaySim `amount`) | Transaction amount |
| `customerBaselineAmount` | DERIVED (real, where history exists) | Expanding mean of the customer's prior transaction amounts. Meaningful only for the ~801 customers with repeat history (see limitation below). |
| `amountToBaselineRatio` | DERIVED | `amount / customerBaselineAmount` |
| `oldbalanceOrg` / `newbalanceOrig` | **REAL** (PaySim) | Origin account balance before/after |
| `isFullAccountDrain` | DERIVED (real signal) | `True` if `oldbalanceOrg == amount` and `newbalanceOrig == 0`. **This is the strongest real fraud signal in the dataset: 96.5% of fraud rows are a full drain vs. 0.0% of legitimate rows.** |
| `deviceId` | **SYNTHETIC** | PaySim has no device field. Deterministically generated per customer (stable hash), with a new/unrecognized device injected on ~85% of fraud rows to simulate account-takeover device signatures. |
| `location` | **SYNTHETIC** | No location field in PaySim. Deterministic home-location per customer; high-risk foreign location injected in tandem with the device anomaly on the same ~85% of fraud rows. |
| `distanceFromHomeKm` | **SYNTHETIC** | Derived from the synthetic location field above. |
| `merchantId` | **REAL** (PaySim `nameDest`) | Destination account identifier |
| `merchantCategory` | **SYNTHETIC** | PaySim distinguishes merchants (`M`-prefixed `nameDest`) from peer accounts, but has no category. Category assigned deterministically per merchant ID. |
| `isMerchant` | **REAL** (derived from PaySim's `M`-prefix convention) | |
| `isNewMerchantForCustomer` | DERIVED | First time this customer→merchant pair appears in the data. **Caveat:** because most PaySim customers have only 1 transaction, this is trivially `True` for ~99% of all rows, fraud and legitimate alike — treat as a weak standalone signal. |
| `emailDomain` | **SYNTHETIC** | No email field in PaySim. Assigned per customer; a disposable-email domain is injected on a subset of anomalous fraud rows as an additional (synthetic) signal. |
| `issuerBank` | **SYNTHETIC** | No card/issuer field in PaySim. Assigned per customer for UI/demo realism only — not used as a scoring signal. |
| `txnCountLast24h` | DERIVED (real for repeat customers, flat for singletons) | Rolling count of this customer's transactions in a 24-step window. **See limitation below.** |
| `linkedToFraudNetwork` | DERIVED (built on synthetic device IDs) | `True` if this transaction's device is shared with any account that has a fraud transaction elsewhere in the dataset. |
| `oldbalanceDest` / `newbalanceDest` | **REAL** (PaySim) | Destination account balance before/after |
| `isFraud` | **REAL** (PaySim ground truth), plus 88 synthetic ATO-burst labels | Target label |
| `isFlaggedFraud` | **REAL** (PaySim) | PaySim's own naive built-in flag — useful as a contrast baseline against your 6-rule engine |
| `_synthetic_session` | METADATA | `True` for the 5,607 augmented rows described below. **Not a model feature** — filter it out before training, or use it to report performance separately for "real PaySim rows" vs. "augmented rows." |

## Known limitation, and how this dataset addresses it

**PaySim models independent transaction events, not repeat customer behavior** — 99.85% of original PaySim customers appear exactly once. This makes velocity and baseline-deviation structurally unlearnable from raw PaySim alone.

**Fix applied:** 800 customers were given synthetic multi-transaction session histories (3–12 transactions each, ~5,607 rows total), generated with `RNG_SEED=42` for reproducibility. Most sessions simulate normal recurring spending; 96 of the 800 customers (12%) simulate an **account-takeover burst pattern** — several small rapid "probe" transactions from a new device, followed by a full-balance drain — a textbook real-world velocity-fraud signature. This produced 88 fraud-labeled burst events with a genuinely elevated `txnCountLast24h` (mean ~7.9, max 12) versus non-burst activity.

**Be upfront about this if asked:** these 5,607 rows are clearly flagged via `_synthetic_session=True` and are an augmentation layer, not disguised PaySim data. The honest framing is: *"PaySim's real balance-drain signal validates our Amount Anomaly rule; because PaySim doesn't model repeat customers, we added a labeled synthetic session layer specifically to validate Velocity and Customer Baseline, and we report these separately."*

## Recommended validation approach

When computing accuracy/precision/recall for your headline stats, report two numbers instead of one blended figure:
1. **Core PaySim performance** (100,000 rows, `_synthetic_session == False`) — validates Amount, Device, Location, Merchant, and Network rules against real transaction/balance data with synthetic anomaly injection for device/location.
2. **Augmented velocity performance** (5,607 rows, `_synthetic_session == True`) — validates Velocity specifically, clearly labeled as synthetic.

This is more defensible under questioning than one combined number, because it lets you say precisely which rules were validated against real vs. synthetic signal.
