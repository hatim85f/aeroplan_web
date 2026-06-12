import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

export const uploadSales = async (token, payload) => {
  const result = await apiRequest('/sales/upload', { token, method: 'POST', body: payload });
  return result?.data || result;
};

export const createManualSales = async (token, payload) => {
  const result = await apiRequest('/sales/manual', { token, method: 'POST', body: payload });
  return result?.data || result?.record || result;
};

export const recalculateSharedSales = async (token, payload = {}) => {
  const result = await apiRequest('/sales/recalculate-shared-sales', { token, method: 'POST', body: payload });
  return result?.data || result;
};

export const listSalesRecords = async (token, params = {}) => {
  const result = await apiRequest(`/sales${buildQuery(params)}`, { token });
  const raw = Array.isArray(result?.data) ? result.data
    : Array.isArray(result?.data?.records) ? result.data.records
    : Array.isArray(result?.records) ? result.records : [];
  return { records: raw, pagination: result?.pagination || result?.data?.pagination || { page: 1, limit: 20, total: raw.length, pages: 1 } };
};

export const getSalesRecordById = async (token, id) => {
  const result = await apiRequest(`/sales/${id}`, { token });
  return result?.data || result?.record || result;
};

export const updateSalesRecord = async (token, id, payload) => {
  const result = await apiRequest(`/sales/${id}`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.record || result;
};

export const updateSalesRecordStatus = async (token, id, payload) => {
  const result = await apiRequest(`/sales/${id}/status`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.record || result;
};

export const deleteSalesRecord = async (token, id) => {
  return apiRequest(`/sales/${id}`, { token, method: 'DELETE' });
};

export const listSalesBatches = async (token, params = {}) => {
  const result = await apiRequest(`/sales/batches${buildQuery(params)}`, { token });
  const raw = Array.isArray(result?.data) ? result.data
    : Array.isArray(result?.data?.batches) ? result.data.batches
    : Array.isArray(result?.batches) ? result.batches : [];
  return { batches: raw, pagination: result?.pagination || result?.data?.pagination || { page: 1, limit: 20, total: raw.length, pages: 1 } };
};

export const getSalesBatchById = async (token, id) => {
  const result = await apiRequest(`/sales/batches/${id}`, { token });
  return result?.data || result?.batch || result;
};

export const getSalesBatchRecords = async (token, batchId, params = {}) => {
  const result = await apiRequest(`/sales/batches/${batchId}/records${buildQuery(params)}`, { token });
  const raw = Array.isArray(result?.data) ? result.data
    : Array.isArray(result?.data?.records) ? result.data.records
    : Array.isArray(result?.records) ? result.records : [];
  return { records: raw, pagination: result?.pagination || result?.data?.pagination || { page: 1, limit: 20, total: raw.length, pages: 1 } };
};

export const deleteSalesBatch = async (token, id) => {
  return apiRequest(`/sales/batches/${id}`, { token, method: 'DELETE' });
};

export const createSalesMapping = async (token, payload) => {
  const result = await apiRequest('/sales/mappings', { token, method: 'POST', body: payload });
  return result?.data || result?.mapping || result;
};

export const listSalesMappings = async (token, params = {}) => {
  const result = await apiRequest(`/sales/mappings${buildQuery(params)}`, { token });
  const raw = Array.isArray(result?.data) ? result.data
    : Array.isArray(result?.data?.mappings) ? result.data.mappings
    : Array.isArray(result?.mappings) ? result.mappings : [];
  return { mappings: raw, pagination: result?.pagination || result?.data?.pagination || { page: 1, limit: 20, total: raw.length, pages: 1 } };
};

export const getSalesMappingById = async (token, id) => {
  const result = await apiRequest(`/sales/mappings/${id}`, { token });
  return result?.data || result?.mapping || result;
};

export const updateSalesMapping = async (token, id, payload) => {
  const result = await apiRequest(`/sales/mappings/${id}`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.mapping || result;
};

export const updateSalesMappingStatus = async (token, id, payload) => {
  const result = await apiRequest(`/sales/mappings/${id}/status`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.mapping || result;
};

export const deleteSalesMapping = async (token, id) => {
  return apiRequest(`/sales/mappings/${id}`, { token, method: 'DELETE' });
};

export const matchSalesOrders = async (token, payload = {}) => {
  const result = await apiRequest('/sales/match-orders', { token, method: 'POST', body: payload });
  return result?.data || result;
};

export const matchSalesTargets = async (token, payload = {}) => {
  const result = await apiRequest('/sales/match-targets', { token, method: 'POST', body: payload });
  return result?.data || result;
};

export const getMatchJob = async (token, type) => {
  const result = await apiRequest(`/sales/match-jobs/${type}`, { token });
  return result?.data || result;
};

// Starts a match job and polls until it finishes (jobs run in the background
// on the server so the request itself can never hit the Heroku 30s timeout).
export const waitForMatchJob = async (token, type, { attempts = 45, intervalMs = 2000 } = {}) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const job = await getMatchJob(token, type).catch(() => null);
    if (job?.status === 'done') return job.result || {};
    if (job?.status === 'failed') throw new Error(job.error || 'Matching failed.');
  }
  throw new Error('Matching is still running in the background — refresh in a minute to see the results.');
};

export const getSalesOverview = async (token, params = {}) => {
  const result = await apiRequest(`/sales/overview${buildQuery(params)}`, { token });
  return result?.data || result;
};

export const cleanupSalesDuplicates = async (token, payload) => {
  const result = await apiRequest('/sales/cleanup-duplicates', { token, method: 'POST', body: payload });
  return result?.data || result;
};

export const applySharedSales = async (token, payload) => {
  const result = await apiRequest('/sales/apply-shared-sales', { token, method: 'POST', body: payload });
  return result?.data || result;
};

export const deleteSalesMonth = async (token, payload) => {
  const result = await apiRequest('/sales/month', { token, method: 'DELETE', body: payload });
  return result?.data || result;
};

export const getSalesChannelBreakdown = async (token, params = {}) => {
  const result = await apiRequest(`/sales/channel-breakdown${buildQuery(params)}`, { token });
  return result?.data || result;
};

export const getSalesChannelItems = async (token, params = {}) => {
  const result = await apiRequest(`/sales/channel-items${buildQuery(params)}`, { token });
  return result?.data || result;
};