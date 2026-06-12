import { apiRequest } from '../apiClient';

const toQueryString = (params = {}) => {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  return query ? `?${query}` : '';
};

export const getMyForecast = (token, params = {}) =>
  apiRequest(`/forecasts/my${toQueryString(params)}`, { token });

export const getTeamForecasts = (token, params = {}) =>
  apiRequest(`/forecasts/team${toQueryString(params)}`, { token });

export const getForecastById = (token, forecastId) =>
  apiRequest(`/forecasts/${forecastId}`, { token });

export const getForecastMatching = (token, params = {}) =>
  apiRequest(`/forecasts/matching${toQueryString(params)}`, { token });

export const addAccountForecast = (token, forecastId, productId, channelId, payload) =>
  apiRequest(`/forecasts/${forecastId}/items/${productId}/channels/${channelId}/accounts`, {
    method: 'POST',
    token,
    body: payload,
  });

export const updateAccountForecast = (token, forecastId, accountForecastId, payload) =>
  apiRequest(`/forecasts/${forecastId}/account-forecasts/${accountForecastId}`, {
    method: 'PATCH',
    token,
    body: payload,
  });

export const deleteAccountForecast = (token, forecastId, accountForecastId) =>
  apiRequest(`/forecasts/${forecastId}/account-forecasts/${accountForecastId}`, {
    method: 'DELETE',
    token,
  });

export const submitForecast = (token, forecastId) =>
  apiRequest(`/forecasts/${forecastId}/submit`, {
    method: 'POST',
    token,
  });

export const updateForecastStatus = (token, forecastId, payload) =>
  apiRequest(`/forecasts/${forecastId}/status`, {
    method: 'PATCH',
    token,
    body: payload,
  });

export const refreshForecast = (token, payload) =>
  apiRequest('/forecasts/refresh', {
    method: 'POST',
    token,
    ...(payload ? { body: payload } : {}),
  });
