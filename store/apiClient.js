import { mainLink } from './mainLink';

export const parseApiResponse = async (response) => {
  if (response.status === 304) {
    const err = new Error('Server returned a cached empty response. Please refresh and try again.');
    err.status = response.status;
    throw err;
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    const err = new Error(result.message || 'Something went wrong. Please try again.');
    Object.assign(err, result);
    err.status = response.status;
    throw err;
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
