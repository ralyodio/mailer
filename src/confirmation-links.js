import { randomUUID } from 'crypto';
import { createHash, createHmac } from 'crypto';
import { URL } from 'url';

// Secret key for HMAC (in production, this should come from environment variables)
const SECRET_KEY = process.env.CONFIRMATION_SECRET || 'default-secret-key-change-in-production';

/**
 * Generates a random confirmation token
 * @returns {string} - URL-safe random token
 */
export const generateConfirmationToken = () => {
  return randomUUID().replace(/-/g, '');
};

/**
 * Generates a deterministic token for a specific subscriber
 * This ensures the same subscriber always gets the same token
 * @param {Object} subscriber - Subscriber object with email
 * @returns {string} - Deterministic token for the subscriber
 * @throws {Error} - If subscriber doesn't have email
 */
export const generateTokenForSubscriber = subscriber => {
  if (!subscriber.email) {
    throw new Error('Subscriber must have an email address');
  }

  // Create a deterministic token based on email and secret
  const email = subscriber.email.toLowerCase().trim();
  const hmac = createHmac('sha256', SECRET_KEY);
  hmac.update(email);

  // Get the hex digest and make it URL-safe
  const hash = hmac.digest('hex');

  // Take first 32 characters and make URL-safe
  return hash.substring(0, 32);
};

/**
 * Creates a confirmation link with token and email parameters
 * @param {string} baseUrl - Base confirmation URL
 * @param {string} token - Confirmation token
 * @param {string} email - Email address
 * @param {Object} additionalParams - Additional URL parameters
 * @returns {string} - Complete confirmation URL
 * @throws {Error} - If required parameters are missing
 */
export const createConfirmationLink = (baseUrl, token, email, additionalParams = {}) => {
  if (!baseUrl) {
    throw new Error('Base URL is required');
  }

  if (!token) {
    throw new Error('Token is required');
  }

  if (!email) {
    throw new Error('Email is required');
  }

  try {
    const url = new URL(baseUrl);

    // Add required parameters
    url.searchParams.set('token', token);
    url.searchParams.set('email', email);

    // Add any additional parameters
    Object.entries(additionalParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  } catch (error) {
    throw new Error(`Invalid base URL: ${error.message}`);
  }
};

/**
 * Parses a confirmation token to extract information
 * @param {string} token - Token to parse
 * @returns {Object} - Parsed token information
 */
export const parseConfirmationToken = token => {
  if (!token || typeof token !== 'string') {
    return {
      valid: false,
      error: 'Token is required and must be a string',
    };
  }

  try {
    // For our HMAC-based tokens, we need the email to validate
    // This function returns basic validation info
    if (token.length !== 32 || !/^[a-f0-9]+$/.test(token)) {
      return {
        valid: false,
        error: 'Invalid token format',
      };
    }

    return {
      valid: true,
      token,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Token parsing failed: ${error.message}`,
    };
  }
};

/**
 * Validates a confirmation token against an email address
 * @param {string} token - Token to validate
 * @param {string} email - Email address to validate against
 * @returns {boolean} - True if token is valid for the email
 */
export const validateConfirmationToken = (token, email) => {
  if (!token || !email) {
    return false;
  }

  try {
    // Normalize email for comparison
    const normalizedEmail = email.toLowerCase().trim();

    // Generate expected token for this email
    const expectedToken = generateTokenForSubscriber({ email: normalizedEmail });

    // Compare tokens
    return token === expectedToken;
  } catch {
    return false;
  }
};

/**
 * Creates a complete confirmation URL for a subscriber
 * @param {string} baseUrl - Base confirmation URL
 * @param {Object} subscriber - Subscriber object
 * @param {Object} additionalParams - Additional URL parameters
 * @returns {string} - Complete confirmation URL
 */
export const createConfirmationUrlForSubscriber = (baseUrl, subscriber, additionalParams = {}) => {
  const token = generateTokenForSubscriber(subscriber);
  return createConfirmationLink(baseUrl, token, subscriber.email, additionalParams);
};

/**
 * Validates a confirmation request from URL parameters
 * @param {Object} urlParams - URL parameters object (e.g., from URLSearchParams)
 * @returns {Object} - Validation result
 */
export const validateConfirmationRequest = urlParams => {
  const token = urlParams.token || urlParams.get?.('token');
  const email = urlParams.email || urlParams.get?.('email');

  if (!token) {
    return {
      valid: false,
      error: 'Missing confirmation token',
    };
  }

  if (!email) {
    return {
      valid: false,
      error: 'Missing email address',
    };
  }

  const isValid = validateConfirmationToken(token, email);

  if (!isValid) {
    return {
      valid: false,
      error: 'Invalid confirmation token',
    };
  }

  return {
    valid: true,
    email: email.toLowerCase().trim(),
    token,
  };
};

/**
 * Generates a secure hash for additional verification
 * @param {string} email - Email address
 * @param {string} timestamp - Timestamp string
 * @returns {string} - Verification hash
 */
export const generateVerificationHash = (email, timestamp) => {
  const data = `${email.toLowerCase().trim()}:${timestamp}`;
  return createHash('sha256')
    .update(data + SECRET_KEY)
    .digest('hex')
    .substring(0, 16);
};

/**
 * Creates an expiring confirmation token with timestamp
 * @param {Object} subscriber - Subscriber object
 * @param {number} expirationHours - Hours until expiration (default: 24)
 * @returns {Object} - Token with expiration info
 */
export const createExpiringToken = (subscriber, expirationHours = 24) => {
  const baseToken = generateTokenForSubscriber(subscriber);
  const expirationTime = Date.now() + expirationHours * 60 * 60 * 1000;
  const timestamp = expirationTime.toString();

  const verificationHash = generateVerificationHash(subscriber.email, timestamp);

  return {
    token: `${baseToken}.${timestamp}.${verificationHash}`,
    expiresAt: new Date(expirationTime),
    expirationTime,
  };
};

/**
 * Validates an expiring token
 * @param {string} expiringToken - Token with expiration data
 * @param {string} email - Email to validate against
 * @returns {Object} - Validation result with expiration info
 */
export const validateExpiringToken = (expiringToken, email) => {
  try {
    const parts = expiringToken.split('.');

    if (parts.length !== 3) {
      return {
        valid: false,
        error: 'Invalid token format',
      };
    }

    const [baseToken, timestamp, hash] = parts;
    const expirationTime = parseInt(timestamp, 10);

    // Check if token has expired
    if (Date.now() > expirationTime) {
      return {
        valid: false,
        error: 'Token has expired',
        expired: true,
      };
    }

    // Validate the base token
    if (!validateConfirmationToken(baseToken, email)) {
      return {
        valid: false,
        error: 'Invalid token',
      };
    }

    // Validate the verification hash
    const expectedHash = generateVerificationHash(email, timestamp);
    if (hash !== expectedHash) {
      return {
        valid: false,
        error: 'Token verification failed',
      };
    }

    return {
      valid: true,
      email: email.toLowerCase().trim(),
      expiresAt: new Date(expirationTime),
    };
  } catch (error) {
    return {
      valid: false,
      error: `Token validation failed: ${error.message}`,
    };
  }
};
