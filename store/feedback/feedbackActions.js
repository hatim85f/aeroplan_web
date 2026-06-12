import { apiRequest } from '../apiClient';

export const submitFeedback = (token, body) =>
  apiRequest('/feedback', { method: 'POST', token, body });
