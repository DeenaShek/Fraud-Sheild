/**
 * FraudShield High-Performance In-Memory Document Store
 * 
 * Provides a 1:1 drop-in replacement for Mongoose models when external MongoDB
 * is not running locally. Supports chaining: .find().sort().skip().limit().select()
 */

class QueryBuilder {
  constructor(dataPromise) {
    this.dataPromise = Promise.resolve(dataPromise);
    this._sortField = null;
    this._sortAsc = true;
    this._skip = 0;
    this._limit = null;
  }

  sort(sortObj) {
    if (sortObj && typeof sortObj === 'object') {
      const [key, val] = Object.entries(sortObj)[0] || [];
      this._sortField = key;
      this._sortAsc = val >= 0 || val === 1 || val === 'asc';
    }
    return this;
  }

  skip(n) {
    this._skip = Number(n) || 0;
    return this;
  }

  limit(n) {
    this._limit = Number(n) || 0;
    return this;
  }

  select() {
    return this;
  }

  async exec() {
    let list = await this.dataPromise;
    if (!Array.isArray(list)) return list;

    if (this._sortField) {
      list = [...list].sort((a, b) => {
        const valA = a[this._sortField];
        const valB = b[this._sortField];
        if (valA === valB) return 0;
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        return this._sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
    }

    if (this._skip > 0) {
      list = list.slice(this._skip);
    }

    if (this._limit && this._limit > 0) {
      list = list.slice(0, this._limit);
    }

    return list.map(item => createDocument(item));
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

function createDocument(data) {
  if (!data) return null;
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
      return this;
    }
  };
  return doc;
}

export class MemoryModel {
  constructor(name) {
    this.name = name;
    this.collection = [];
  }

  matchesFilter(doc, filter = {}) {
    for (const [key, value] of Object.entries(filter)) {
      if (key === '$or' && Array.isArray(value)) {
        const matchAny = value.some(subFilter => this.matchesFilter(doc, subFilter));
        if (!matchAny) return false;
        continue;
      }
      if (key === '$ne') continue;
      
      const docVal = doc[key];
      if (value && typeof value === 'object' && value.$ne !== undefined) {
        if (docVal === value.$ne) return false;
        continue;
      }

      if (value instanceof RegExp) {
        if (!value.test(String(docVal || ''))) return false;
        continue;
      }

      if (docVal !== value) {
        return false;
      }
    }
    return true;
  }

  find(filter = {}) {
    const results = this.collection.filter(doc => this.matchesFilter(doc, filter));
    return new QueryBuilder(results);
  }

  async findOne(filter = {}) {
    const doc = this.collection.find(d => this.matchesFilter(d, filter));
    return doc ? createDocument(doc) : null;
  }

  async findById(id) {
    const doc = this.collection.find(d => d._id === id || String(d._id) === String(id));
    return doc ? createDocument(doc) : null;
  }

  async countDocuments(filter = {}) {
    return this.collection.filter(d => this.matchesFilter(d, filter)).length;
  }

  async create(data) {
    if (Array.isArray(data)) {
      return this.insertMany(data);
    }
    const doc = createDocument(data);
    this.collection.push(doc);
    return doc;
  }

  async insertMany(items = []) {
    const created = items.map(item => createDocument(item));
    this.collection.push(...created);
    return created;
  }

  async findOneAndUpdate(filter, update, options = {}) {
    const idx = this.collection.findIndex(d => this.matchesFilter(d, filter));
    if (idx === -1) {
      if (options.upsert) {
        const newDoc = createDocument({ ...filter, ...update });
        this.collection.push(newDoc);
        return newDoc;
      }
      return null;
    }
    const updated = {
      ...this.collection[idx],
      ...update,
      updatedAt: new Date()
    };
    this.collection[idx] = updated;
    return createDocument(updated);
  }

  async updateMany(filter, update) {
    let count = 0;
    this.collection.forEach((doc, idx) => {
      if (this.matchesFilter(doc, filter)) {
        this.collection[idx] = { ...doc, ...update, updatedAt: new Date() };
        count++;
      }
    });
    return { modifiedCount: count };
  }
}

// Global Memory Instances
export const memUsers = new MemoryModel('User');
export const memCustomers = new MemoryModel('Customer');
export const memTransactions = new MemoryModel('Transaction');
export const memAlerts = new MemoryModel('Alert');
export const memConfigs = new MemoryModel('EngineConfig');
