import { apiRequest } from '../apiClient';

/**
 * POST /foc-overrides
 * Creates a new FOC override document for an account.
 *
 * Body: { accountId, startDate, endDate, overrides: [{ productId, overridePercentage, notes? }] }
 * Dates apply to the whole document, NOT to individual overrides.
 */
export const createFocOverrides = async (token, accountId, startDate, endDate, overrides) => {
  const result = await apiRequest('/foc-overrides', {
    token,
    method: 'POST',
    body: { accountId, startDate, endDate, overrides },
  });
  return result?.data || result;
};

/**
 * POST /foc-overrides/:accountId/entries
 * Appends new override entries to an existing document (no dates needed).
 *
 * Body: { entries: [{ productId, overridePercentage, notes? }] }
 */
export const addFocEntries = async (token, accountId, entries) => {
  const result = await apiRequest(`/foc-overrides/${accountId}/entries`, {
    token,
    method: 'POST',
    body: { entries },
  });
  return result?.data || result;
};

/**
 * GET /foc-overrides
 * List overrides. Optional query: ?page=1&limit=20&accountId=...&productId=...
 * Returns { data: [...], pagination: {...} }
 */
export const listFocOverrides = async (token, params = {}) => {
  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const result = await apiRequest(`/foc-overrides${query ? `?${query}` : ''}`, { token });
  return {
    data: result?.data || [],
    pagination: result?.pagination || { page: 1, limit: 20, total: 0, pages: 1 },
  };
};

/**
 * GET /foc-overrides/:accountId
 * Returns all override entries for a single account.
 */
export const getFocOverridesByAccount = async (token, accountId) => {
  const result = await apiRequest(`/foc-overrides/${accountId}`, { token });
  return result?.data || result;
};

/**
 * PATCH /foc-overrides/:accountId
 * Replaces ALL overrides for the account (full replace).
 *
 * Body: { startDate, endDate, overrides: [{ productId, overridePercentage, notes? }] }
 */
export const replaceFocOverrides = async (token, accountId, startDate, endDate, overrides) => {
  const result = await apiRequest(`/foc-overrides/${accountId}`, {
    token,
    method: 'PATCH',
    body: { startDate, endDate, overrides },
  });
  return result?.data || result;
};

/**
 * PATCH /foc-overrides/:accountId/entries/:entryId
 * Updates a single override entry. Only send productId, overridePercentage, and/or notes — no dates.
 *
 * Body (any subset): { productId?, overridePercentage?, notes? }
 */
export const updateFocEntry = async (token, accountId, entryId, changes) => {
  const result = await apiRequest(`/foc-overrides/${accountId}/entries/${entryId}`, {
    token,
    method: 'PATCH',
    body: changes,
  });
  return result?.data || result;
};

/**
 * DELETE /foc-overrides/:accountId
 * Deletes the entire override document for an account.
 */
export const deleteFocOverrides = async (token, accountId) => {
  return apiRequest(`/foc-overrides/${accountId}`, { token, method: 'DELETE' });
};

/**
 * DELETE /foc-overrides/:accountId/entries/:entryId
 * Deletes a single override entry.
 */
export const deleteFocEntry = async (token, accountId, entryId) => {
  return apiRequest(`/foc-overrides/${accountId}/entries/${entryId}`, {
    token,
    method: 'DELETE',
  });
};
