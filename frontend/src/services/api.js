const BASE_URL = import.meta.env.VITE_API_URL || '';

function getAuthHeaders() {
  const token = localStorage.getItem('fraudshield_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function handleResponse(response) {
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('fraudshield_token');
      localStorage.removeItem('fraudshield_user');
      window.dispatchEvent(new Event('auth_expired'));
    }
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || `HTTP Error ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Auth
  async login(username, password) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return handleResponse(res);
  },

  async getMe() {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // Transactions
  async getTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}/api/transactions?${query}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getStatsOverview() {
    const res = await fetch(`${BASE_URL}/api/transactions/stats/overview`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getCustomers() {
    const res = await fetch(`${BASE_URL}/api/transactions/customers`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getCustomerProfile(customerId) {
    const res = await fetch(`${BASE_URL}/api/transactions/customers/${customerId}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // Alerts
  async getAlerts(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${BASE_URL}/api/alerts?${query}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async updateAlertStatus(alertId, status) {
    const res = await fetch(`${BASE_URL}/api/alerts/${alertId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    return handleResponse(res);
  },

  // Investigation Dossier
  async getInvestigationDossier(transactionId) {
    const res = await fetch(`${BASE_URL}/api/investigation/${transactionId}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async queryCopilot(transactionId, query) {
    const res = await fetch(`${BASE_URL}/api/investigation/${transactionId}/copilot`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ query })
    });
    return handleResponse(res);
  },

  async resolveCase(transactionId, resolutionAction, notes) {
    const res = await fetch(`${BASE_URL}/api/investigation/${transactionId}/resolve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ resolutionAction, notes })
    });
    return handleResponse(res);
  },

  // Admin Portal
  async getAdminHealth() {
    const res = await fetch(`${BASE_URL}/api/admin/health`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getEngineConfig() {
    const res = await fetch(`${BASE_URL}/api/admin/config`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async updateEngineConfig(config) {
    const res = await fetch(`${BASE_URL}/api/admin/config`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(config)
    });
    return handleResponse(res);
  },

  async getModelTelemetry() {
    const res = await fetch(`${BASE_URL}/api/admin/model-telemetry`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getAdminUsers() {
    const res = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getAdminMetrics() {
    const res = await fetch(`${BASE_URL}/api/admin/metrics`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async getFullNetworkGraph() {
    const res = await fetch(`${BASE_URL}/api/admin/network-graph`, {
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  // Simulator Controls
  async startSimulator() {
    const res = await fetch(`${BASE_URL}/api/transactions/simulator/start`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async stopSimulator() {
    const res = await fetch(`${BASE_URL}/api/transactions/simulator/stop`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async setSimulatorSpeed(intervalMs) {
    const res = await fetch(`${BASE_URL}/api/transactions/simulator/speed`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ intervalMs })
    });
    return handleResponse(res);
  },

  async injectWorkedExample() {
    const res = await fetch(`${BASE_URL}/api/transactions/simulator/inject-worked-example`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async injectMerchantAnomaly() {
    const res = await fetch(`${BASE_URL}/api/transactions/simulator/inject-merchant-anomaly`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async injectDeviceAnomaly() {
    const res = await fetch(`${BASE_URL}/api/transactions/simulator/inject-device-anomaly`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async injectTravelAnomaly() {
    const res = await fetch(`${BASE_URL}/api/transactions/simulator/inject-travel-anomaly`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  },

  async injectAttackWave() {
    const res = await fetch(`${BASE_URL}/api/transactions/simulator/inject-attack-wave`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(res);
  }
};
