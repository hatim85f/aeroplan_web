import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

/** Returns today's date as YYYY-MM-DD */
export const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * GET /api/medical-rep-product-assignments/medical-reps/:medicalRepId
 * Params: { activeOn: 'YYYY-MM-DD' }
 * Response: { data: [...] }
 */
export const getRepProductAssignments = async (token, medicalRepId, params = {}) => {
  const result = await apiRequest(
    `/medical-rep-product-assignments/medical-reps/${medicalRepId}${buildQuery(params)}`,
    { token },
  );
  return result?.data || result?.assignments || [];
};

/**
 * POST /api/medical-rep-product-assignments
 * Body: { medicalRepId, productIds: [...], startDate, endDate?, notes? }
 * Response: { data: { assignments: [...], createdCount: N } }
 */
export const createRepProductAssignment = async (token, payload) => {
  const result = await apiRequest('/medical-rep-product-assignments', {
    token, method: 'POST', body: payload,
  });
  return result?.data || result;
};

/**
 * PATCH /api/medical-rep-product-assignments/:id
 * Body: { startDate?, endDate?, notes? }
 */
export const updateRepProductAssignment = async (token, id, payload) => {
  const result = await apiRequest(`/medical-rep-product-assignments/${id}`, {
    token, method: 'PATCH', body: payload,
  });
  return result?.data || result?.assignment || result;
};

/**
 * POST /api/medical-reps/:medicalRepId/close
 * Closes all active product assignments for a resigned rep.
 */
export const closeRepAssignments = async (token, medicalRepId) => {
  const result = await apiRequest(`/medical-reps/${medicalRepId}/close`, {
    token, method: 'POST',
  });
  return result?.data || result;
};
