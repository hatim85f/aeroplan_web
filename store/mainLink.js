const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export const BASE_URL = (configuredBaseUrl || 'https://aeroplan-0817f96a9a4e.herokuapp.com').replace(
  /\/+$/,
  '',
);
export const mainLink = `${BASE_URL}/api`;
