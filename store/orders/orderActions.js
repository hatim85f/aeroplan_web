import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

/** GET /api/auth/me — refresh current user (for latest manager email) */
export const getCurrentUser = async (token) => {
  const result = await apiRequest('/auth/me', { token });
  return result?.data || result?.user || result;
};

/** GET /api/orders/init-data?accountId=<id> */
export const getOrderInitData = async (token, accountId) => {
  const result = await apiRequest(
    `/orders/init-data?accountId=${encodeURIComponent(accountId)}`,
    { token }
  );
  return result?.data || result;
};

/** GET /api/orders */
export const listOrders = async (token, params = {}) => {
  const result = await apiRequest(`/orders${buildQuery(params)}`, { token });
  return {
    data: result?.data || result?.orders || [],
    pagination: result?.pagination || { page: 1, limit: 20, total: 0, pages: 1 },
    summary: result?.summary || null,
  };
};

/** GET /api/orders/:id */
export const getOrderById = async (token, id) => {
  const result = await apiRequest(`/orders/${id}`, { token });
  return result?.data || result?.order || result;
};

/** POST /api/orders */
export const createOrder = async (token, payload) => {
  const result = await apiRequest('/orders', { token, method: 'POST', body: payload });
  return result?.data || result?.order || result;
};

/** PATCH /api/orders/:id */
export const updateOrder = async (token, id, payload) => {
  const result = await apiRequest(`/orders/${id}`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.order || result;
};

/** PATCH /api/orders/:id/status */
export const updateOrderStatus = async (token, id, payload) => {
  const result = await apiRequest(`/orders/${id}/status`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.order || result;
};

/** DELETE /api/orders/:id */
export const deleteOrder = async (token, id) => {
  return apiRequest(`/orders/${id}`, { token, method: 'DELETE' });
};

/** POST /api/orders/:id/mark-email-sent */
export const markOrderEmailSent = async (token, id) => {
  const result = await apiRequest(`/orders/${id}/mark-email-sent`, { token, method: 'POST' });
  return result?.data || result;
};
