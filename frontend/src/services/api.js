const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const isProxyFailure = res.status === 500 && !data && res.headers.get('content-type')?.includes('text/plain');
      const errorMsg = data?.error || (isProxyFailure
        ? 'The local API is not responding on port 8000. Start the R backend and retry.'
        : `HTTP Error ${res.status}: ${res.statusText}`);
      const err = new Error(errorMsg);
      err.code = data?.code || 'HTTP_ERROR';
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    if (error.code) throw error;
    const netErr = new Error(error.message || 'Network connection failed');
    netErr.code = 'NETWORK_ERROR';
    throw netErr;
  }
}

export const api = {
  getHealth: () => request('/api/health'),

  getCurrencies: () => request('/api/currencies'),

  getLatestRate: (base = 'USD', quote = 'INR', refresh = false) => {
    const query = new URLSearchParams({ base, quote });
    if (refresh) query.set('refresh', 'true');
    return request(`/api/rates/latest?${query.toString()}`);
  },

  getHistory: (base = 'USD', quote = 'INR', from = null, to = null) => {
    const query = new URLSearchParams({ base, quote });
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    return request(`/api/rates/history?${query.toString()}`);
  },

  convert: (amount = 100, from = 'USD', to = 'INR') => {
    const query = new URLSearchParams({
      amount: String(amount),
      from,
      to,
    });
    return request(`/api/convert?${query.toString()}`);
  },

  getAnalytics: (window = 30) => {
    return request(`/api/analytics?window=${encodeURIComponent(window)}`);
  },

  getNowcast: () => request('/api/nowcast'),

  getForecast: (horizons = '1,3,5') => {
    return request(`/api/forecast?horizons=${encodeURIComponent(horizons)}`);
  },

  getEvaluation: (refresh = false) => {
    const query = refresh ? '?refresh=true' : '';
    return request(`/api/evaluation${query}`);
  },
};

