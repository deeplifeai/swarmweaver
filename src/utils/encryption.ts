/**
 * Simple encryption utilities for protecting sensitive data in local storage
 * Note: This is not cryptographically secure and should be replaced with
 * a proper encryption library in production environments
 */

export const encryptData = (data: string, salt = ''): string => {
  // Simple encryption for demo purposes - not for production use
  // In production, use a proper encryption library
  return btoa(data + salt);
};

export const decryptData = (encryptedData: string, salt = ''): string => {
  try {
    const decrypted = atob(encryptedData);
    return salt ? decrypted.slice(0, -salt.length) : decrypted;
  } catch (error) {
    console.error('Failed to decrypt data:', error);
    return '';
  }
}; 