import { mainLink } from './mainLink';

export const parseApiResponse = async (response) => {
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || 'Something went wrong. Please try again.');
  }

  return result;
};

export const apiRequest = async (path, { token, method = 'GET', body, headers } = {}) => {
  const response = await fetch(`${mainLink}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  return parseApiResponse(response);
};
