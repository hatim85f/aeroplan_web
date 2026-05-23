import { apiRequest } from '../apiClient';

export const USER_DETAILS_STORAGE_KEY = 'aeroplan:userDetails';

export const loginUser = async ({ email, password }) => {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: {
      email: email.trim(),
      password,
    },
  });
};

export const registerUser = async ({
  email,
  password,
  fullName,
  userName,
  phone,
  role,
  managerId,
}) => {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: {
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      userName: userName.trim(),
      phone: phone.trim(),
      role: role || 'representative',
      ...(managerId ? { managerId: managerId.trim() } : {}),
    },
  });
};

export const verifyAccount = async ({ email, code }) => {
  return apiRequest('/auth/verify-account', {
    method: 'POST',
    body: {
      email: email.trim(),
      code: code.trim(),
    },
  });
};

export const resendVerificationCode = async ({ email }) => {
  return apiRequest('/auth/resend-verification-code', {
    method: 'POST',
    body: {
      email: email.trim(),
    },
  });
};

export const forgotPassword = async ({ email }) => {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: {
      email: email.trim(),
    },
  });
};

export const resetPassword = async ({ email, code, token, password }) => {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: {
      ...(email ? { email: email.trim() } : {}),
      ...(code ? { code: code.trim() } : {}),
      ...(token ? { token: token.trim() } : {}),
      password,
    },
  });
};

export const getCurrentUser = async (token) => {
  const result = await apiRequest('/auth/me', { token });
  return result.data;
};

export const updateUserProfile = async (token, profile) => {
  const result = await apiRequest('/auth/me/profile', {
    method: 'PATCH',
    token,
    body: profile,
  });

  return result.data || result.user || result.profile || result;
};

export const saveUserDetails = async (payload) => {
  localStorage.setItem(USER_DETAILS_STORAGE_KEY, JSON.stringify(payload));
  return payload;
};

export const getSavedUserDetails = async () => {
  const savedUser = localStorage.getItem(USER_DETAILS_STORAGE_KEY);
  return savedUser ? JSON.parse(savedUser) : null;
};

export const clearUserDetails = async () => {
  localStorage.removeItem(USER_DETAILS_STORAGE_KEY);
};
