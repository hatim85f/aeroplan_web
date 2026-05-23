import { apiRequest } from '../apiClient';

export const getAccounts = async (token) => {
  const result = await apiRequest('/accounts', { token });
  return result.data || result.accounts || [];
};

export const getAccountById = async (token, accountId) => {
  const result = await apiRequest(`/accounts/${accountId}`, { token });
  return result.data || result.account || result;
};

export const saveAccount = async (token, account) => {
  const result = await apiRequest(account.id ? `/accounts/${account.id}` : '/accounts', {
    token,
    method: account.id ? 'PATCH' : 'POST',
    body: account,
  });

  return result.data || result.account || result;
};
