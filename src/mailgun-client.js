import Mailgun from 'mailgun.js';
import FormData from 'form-data';
import { validateEmail } from './csv-parser.js';

/**
 * Validates Mailgun configuration
 * @param {Object} config - Mailgun configuration object
 * @throws {Error} - If configuration is invalid
 */
export const validateMailgunConfig = config => {
  if (!config.apiKey) {
    throw new Error('Mailgun API key is required');
  }

  if (!config.domain) {
    throw new Error('Mailgun domain is required');
  }

  if (!config.fromEmail) {
    throw new Error('From email address is required');
  }

  if (!validateEmail(config.fromEmail)) {
    throw new Error('From email address is invalid');
  }
};

/**
 * Creates a Mailgun client with validated configuration
 * @param {Object} config - Mailgun configuration
 * @returns {Object} - Mailgun client instance
 */
export const createMailgunClient = config => {
  // Set default fromName if not provided
  const normalizedConfig = {
    ...config,
    fromName: config.fromName || 'Mailer',
  };

  validateMailgunConfig(normalizedConfig);

  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: 'api',
    key: normalizedConfig.apiKey,
  });

  return {
    config: normalizedConfig,
    mailgun: mg,
  };
};

/**
 * Validates email data before sending
 * @param {Object} emailData - Email data to validate
 * @throws {Error} - If email data is invalid
 */
const validateEmailData = emailData => {
  if (!emailData.to) {
    throw new Error('Recipient email is required');
  }

  if (!validateEmail(emailData.to)) {
    throw new Error('Invalid recipient email format');
  }

  if (!emailData.subject) {
    throw new Error('Email subject is required');
  }

  if (!emailData.text && !emailData.html) {
    throw new Error('Either text or html content is required');
  }
};

/**
 * Sends a single email via Mailgun
 * @param {Object} client - Mailgun client instance
 * @param {Object} emailData - Email data
 * @returns {Promise<Object>} - Send result
 */
export const sendEmail = async (client, emailData) => {
  try {
    validateEmailData(emailData);

    const messageData = {
      from: `${client.config.fromName} <${client.config.fromEmail}>`,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html,
    };

    // Add custom headers if provided
    if (emailData.headers) {
      Object.entries(emailData.headers).forEach(([key, value]) => {
        messageData[`h:${key}`] = value;
      });
    }

    const response = await client.mailgun.messages.create(client.config.domain, messageData);

    return {
      success: true,
      messageId: response.id,
      response: response.message,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Processes template placeholders in text
 * @param {string} template - Template string with placeholders
 * @param {Object} data - Data to replace placeholders
 * @returns {string} - Processed template
 */
const processTemplate = (template, data) => {
  if (!template) return template;

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return data[key] || '';
  });
};

/**
 * Creates a delay for rate limiting
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after delay
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sends bulk emails to multiple recipients with rate limiting
 * @param {Object} client - Mailgun client instance
 * @param {Array} subscribers - Array of subscriber objects
 * @param {Object} emailTemplate - Email template with placeholders
 * @param {Object} options - Options for bulk sending
 * @returns {Promise<Array>} - Array of send results
 */
export const sendBulkEmails = async (client, subscribers, emailTemplate, options = {}) => {
  const { rateLimit = 10 } = options; // Default 10 emails per second
  const delayBetweenEmails = 1000 / rateLimit;
  const results = [];

  for (let i = 0; i < subscribers.length; i++) {
    const subscriber = subscribers[i];

    // Process template placeholders
    const processedEmail = {
      to: subscriber.email,
      subject: processTemplate(emailTemplate.subject, subscriber),
      text: processTemplate(emailTemplate.text, subscriber),
      html: processTemplate(emailTemplate.html, subscriber),
    };

    // Add any additional headers from template
    if (emailTemplate.headers) {
      processedEmail.headers = emailTemplate.headers;
    }

    const result = await sendEmail(client, processedEmail);

    results.push({
      email: subscriber.email,
      ...result,
    });

    // Rate limiting: delay between emails (except for the last one)
    if (i < subscribers.length - 1) {
      await delay(delayBetweenEmails);
    }
  }

  return results;
};

/**
 * Gets statistics from bulk email results
 * @param {Array} results - Array of send results
 * @returns {Object} - Statistics object
 */
export const getBulkEmailStats = results => {
  const total = results.length;
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? (successful / total) * 100 : 0,
  };
};

/**
 * Validates Mailgun connection by sending a test email
 * @param {Object} client - Mailgun client instance
 * @param {string} testEmail - Email address to send test to
 * @returns {Promise<Object>} - Validation result
 */
export const validateMailgunConnection = async (client, testEmail) => {
  const testEmailData = {
    to: testEmail,
    subject: 'Mailgun Connection Test',
    text: 'This is a test email to validate your Mailgun configuration.',
    html: '<p>This is a test email to validate your Mailgun configuration.</p>',
  };

  try {
    const result = await sendEmail(client, testEmailData);
    return {
      valid: result.success,
      message: result.success ? 'Connection successful' : result.error,
    };
  } catch (error) {
    return {
      valid: false,
      message: `Connection failed: ${error.message}`,
    };
  }
};
