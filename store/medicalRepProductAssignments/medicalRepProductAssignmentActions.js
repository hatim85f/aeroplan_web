import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * GET /api/medical-rep-product-assignments/medical-reps/:medicalRepId
 * Supported params: activeOn, status, year, productId, lineId, isActive
 * Response: { data: [...assignments] }  — each assignment has a full productId object
 */
export const getMedicalRepProductAssignments = async (token, medicalRepId, params = {}) => {
  const result = await apiRequest(
    `/medical-rep-product-assignments/medical-reps/${medicalRepId}${buildQuery(params)}`,
    { token },
  );
  // Handle { data: [...] }, { data: { assignments: [...] } }, or { assignments: [...] }
  const raw = result?.data?.assignments
    ?? (Array.isArray(result?.data) ? result.data : undefined)
    ?? result?.assignments
    ?? [];
  return Array.isArray(raw) ? raw : [];
};

/**
 * POST /api/medical-rep-product-assignments
 * Body: { medicalRepId, productId?, products?, startDate, endDate?, percentage?, accountabilityPercentage?, notes? }
 */
export const createMedicalRepProductAssignment = async (token, payload) => {
  const result = await apiRequest('/medical-rep-product-assignments', {
    token, method: 'POST', body: payload,
  });
  return result?.data || result;
};

/**
 * POST /api/medical-rep-product-assignments/bulk
 * Body: { assignments: [{ medicalRepId, productId, startDate, endDate?, percentage? }] }
 */
export const bulkCreateMedicalRepProductAssignments = async (token, payload) => {
  const result = await apiRequest('/medical-rep-product-assignments/bulk', {
    token, method: 'POST', body: payload,
  });
  return result?.data || result;
};

/**
 * PATCH /api/medical-rep-product-assignments/:id
 * Body: { startDate?, endDate?, percentage?, accountabilityPercentage?, notes? }
 */
export const updateMedicalRepProductAssignment = async (token, id, payload) => {
  const result = await apiRequest(`/medical-rep-product-assignments/${id}`, {
    token, method: 'PATCH', body: payload,
  });
  return result?.data || result?.assignment || result;
};

/**
 * PATCH /api/medical-rep-product-assignments/medical-reps/:medicalRepId/close
 * Closes all active product assignments for a resigned rep.
 */
export const closeMedicalRepAssignments = async (token, medicalRepId) => {
  const result = await apiRequest(
    `/medical-rep-product-assignments/medical-reps/${medicalRepId}/close`,
    { token, method: 'PATCH' },
  );
  return result?.data || result;
};
