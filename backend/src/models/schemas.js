import mongoose from 'mongoose';
import { 
  memUsers, 
  memCustomers, 
  memTransactions, 
  memAlerts, 
  memConfigs 
} from './memoryStore.js';
import { isConnectedToExternalMongo } from '../config/db.js';

// Mongoose Model definitions (if real MongoDB is connected)
const userMongooseSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'ANALYST'], default: 'ANALYST' },
  name: { type: String, required: true },
  badgeId: { type: String, default: 'OP-408' },
  avatar: { type: String },
  lastLogin: { type: Date, default: Date.now }
}, { timestamps: true });

const customerMongooseSchema = new mongoose.Schema({
  customerId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  homeLocation: { type: String, default: 'Chennai, India' },
  baselineAmount: { type: Number, default: 3200 },
  knownDevices: [{ type: String }],
  frequentMerchants: [{ type: String }],
  riskStatus: { type: String, default: 'CLEAN' },
  totalTransactionsCount: { type: Number, default: 0 },
  averageDailySpend: { type: Number, default: 3200 }
}, { timestamps: true });

const transactionMongooseSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true, index: true },
  customerId: { type: String, required: true, index: true },
  customerName: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  customerBaseline: { type: Number, default: 3200 },
  amountRatio: { type: Number, default: 1.0 },
  deviceId: { type: String, required: true },
  deviceOs: { type: String },
  isNewDevice: { type: Boolean, default: false },
  location: { type: String, required: true },
  homeLocation: { type: String, default: 'Chennai, India' },
  isLocationAnomalous: { type: Boolean, default: false },
  ipAddress: { type: String, default: '192.168.1.1' },
  merchant: mongoose.Schema.Types.Mixed,
  isNewMerchant: { type: Boolean, default: false },
  velocity: { type: Number, default: 1 },
  networkRiskSignal: { type: Boolean, default: false },
  cardLast4: { type: String },
  cardType: { type: String },
  ruleScore: { type: Number, default: 0 },
  riskBand: { type: String, default: 'LOW' },
  action: { type: String, default: 'ALLOW' },
  actionDescription: { type: String },
  reasons: [mongoose.Schema.Types.Mixed],
  mlProbability: { type: Number, default: 0.05 },
  mlProbabilityDisplay: { type: String, default: '5%' },
  mlConfidence: { type: String, default: 'LOW' },
  mlFeatures: mongoose.Schema.Types.Mixed,
  mlContributions: [mongoose.Schema.Types.Mixed],
  status: { type: String, default: 'PROCESSED' },
  investigationNotes: { type: String },
  resolvedBy: { type: String },
  resolvedAt: { type: Date },
  isWorkedExample: { type: Boolean, default: false }
}, { timestamps: true });

const alertMongooseSchema = new mongoose.Schema({
  alertId: { type: String, required: true, unique: true, index: true },
  transactionId: { type: String, required: true, index: true },
  customerId: { type: String, required: true },
  customerName: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  riskScore: { type: Number, required: true },
  riskBand: { type: String, required: true },
  actionRequired: { type: String, required: true },
  topReasons: [String],
  mlProbability: { type: String, default: '0%' },
  status: { type: String, default: 'OPEN' },
  assignedTo: { type: String }
}, { timestamps: true });

const configMongooseSchema = new mongoose.Schema({
  configKey: { type: String, default: 'GLOBAL_RULE_CONFIG', unique: true },
  rules: mongoose.Schema.Types.Mixed,
  thresholds: mongoose.Schema.Types.Mixed,
  updatedBy: { type: String, default: 'System Admin' }
}, { timestamps: true });

const MongooseUser = mongoose.models.User || mongoose.model('User', userMongooseSchema);
const MongooseCustomer = mongoose.models.Customer || mongoose.model('Customer', customerMongooseSchema);
const MongooseTransaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionMongooseSchema);
const MongooseAlert = mongoose.models.Alert || mongoose.model('Alert', alertMongooseSchema);
const MongooseConfig = mongoose.models.EngineConfig || mongoose.model('EngineConfig', configMongooseSchema);

// Hybrid Model Factory: redirects calls dynamically based on runtime connection
function createHybridModel(mongooseModel, memoryStore) {
  function ModelConstructor(data = {}) {
    if (isConnectedToExternalMongo()) {
      return new mongooseModel(data);
    }
    const doc = {
      ...data,
      _id: data._id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      toObject() {
        return { ...this };
      },
      async save() {
        this.updatedAt = new Date();
        const existingIdx = memoryStore.collection.findIndex(d => d._id === this._id || (d.transactionId && d.transactionId === this.transactionId));
        if (existingIdx !== -1) {
          memoryStore.collection[existingIdx] = this;
        } else {
          memoryStore.collection.push(this);
        }
        return this;
      }
    };
    return doc;
  }

  // Delegate static methods
  ModelConstructor.find = (filter) => isConnectedToExternalMongo() ? mongooseModel.find(filter) : memoryStore.find(filter);
  ModelConstructor.findOne = (filter) => isConnectedToExternalMongo() ? mongooseModel.findOne(filter) : memoryStore.findOne(filter);
  ModelConstructor.findById = (id) => isConnectedToExternalMongo() ? mongooseModel.findById(id) : memoryStore.findById(id);
  ModelConstructor.countDocuments = (filter) => isConnectedToExternalMongo() ? mongooseModel.countDocuments(filter) : memoryStore.countDocuments(filter);
  ModelConstructor.create = (data) => isConnectedToExternalMongo() ? mongooseModel.create(data) : memoryStore.create(data);
  ModelConstructor.insertMany = (data) => isConnectedToExternalMongo() ? mongooseModel.insertMany(data) : memoryStore.insertMany(data);
  ModelConstructor.findOneAndUpdate = (filter, update, opts) => isConnectedToExternalMongo() ? mongooseModel.findOneAndUpdate(filter, update, opts) : memoryStore.findOneAndUpdate(filter, update, opts);
  ModelConstructor.updateMany = (filter, update) => isConnectedToExternalMongo() ? mongooseModel.updateMany(filter, update) : memoryStore.updateMany(filter, update);

  return ModelConstructor;
}

export const User = createHybridModel(MongooseUser, memUsers);
export const Customer = createHybridModel(MongooseCustomer, memCustomers);
export const Transaction = createHybridModel(MongooseTransaction, memTransactions);
export const Alert = createHybridModel(MongooseAlert, memAlerts);
export const EngineConfig = createHybridModel(MongooseConfig, memConfigs);
