import { apiRequest } from '../apiClient';

/**
 * POST /products/bulk
 * Sends ONE batch (max 15 products).
 * The screen calls this in a loop, splitting the full list into chunks of 15.
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
