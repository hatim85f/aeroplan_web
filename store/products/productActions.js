import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

export const listProducts = async (token, params = {}) => {
  const result = await apiRequest(`/products${buildQuery(params)}`, { token });
  return {
    products: result?.data || result?.products || [],
    pagination: result?.pagination || { page: 1, limit: 20, total: 0, pages: 0 },
  };
};

export const getProductById = async (token, id) => {
  const result = await apiRequest(`/products/${id}`, { token });
  return result?.data || result?.product || result;
};

export const createProduct = async (token, payload) => {
  const result = await apiRequest('/products', { token, method: 'POST', body: payload });
  return result?.data || result?.product || result;
};

export const updateProduct = async (token, id, payload) => {
  const result = await apiRequest(`/products/${id}`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.product || result;
};

export const updateProductStatus = async (token, id, payload) => {
  const result = await apiRequest(`/products/${id}/status`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.product || result;
};

export const deleteProduct = async (token, id) => {
  return apiRequest(`/products/${id}`, { token, method: 'DELETE' });
};
