import { apiRequest } from '../apiClient';

/**
 * POST /products/bulk
 * Max 500 products per request.
 *
 * Response: { success, message, data: { total, createdCount, failedCount,
 *   createdProductIds, createdProducts, failed } }
 */
export const bulkCreateProducts = async (token, products) => {
  return apiRequest('/products/bulk', {
    method: 'POST',
    token,
    body: { products },
  });
};
