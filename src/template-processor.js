import { promises as fs } from 'fs';

/**
 * Validates template structure and required fields
 * @param {Object} template - Template object to validate
 * @throws {Error} - If template is invalid
 */
export const validateTemplate = template => {
  if (!template.subject) {
    throw new Error('Template must include a subject');
  }

  if (!template.text && !template.html) {
    throw new Error('Template must include either text or html content');
  }

  if (!template.confirmationUrl) {
    throw new Error('Template must include a confirmationUrl');
  }
};

/**
 * Processes template placeholders in text
 * @param {string} template - Template string with placeholders
 * @param {Object} data - Data to replace placeholders
 * @returns {string} - Processed template
 */
export const processTemplate = (template, data) => {
  if (template === null || template === undefined) {
    return template;
  }

  if (typeof template !== 'string') {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return data[key] || '';
  });
};

/**
 * Extracts variable names from template placeholders
 * @param {string} template - Template string
 * @returns {Array<string>} - Array of unique variable names
 */
export const getTemplateVariables = template => {
  if (!template || typeof template !== 'string') {
    return [];
  }

  const matches = template.match(/\{(\w+)\}/g);
  if (!matches) {
    return [];
  }

  // Extract variable names and remove duplicates
  const variables = matches.map(match => match.slice(1, -1));
  return [...new Set(variables)];
};

/**
 * Processes a complete template for a specific subscriber
 * @param {Object} template - Email template object
 * @param {Object} subscriber - Subscriber data
 * @param {string} confirmationToken - Unique confirmation token
 * @returns {Object} - Processed email data
 */
export const processTemplateForSubscriber = (template, subscriber, confirmationToken) => {
  // Create data object with subscriber info and confirmation token
  const templateData = {
    ...subscriber,
    confirmation_token: confirmationToken,
    email: subscriber.email,
  };

  // Process confirmation URL first
  const confirmationUrl = processTemplate(template.confirmationUrl, {
    ...templateData,
    email: encodeURIComponent(subscriber.email), // URL encode email for safety
  });

  // Add processed confirmation URL to template data
  const fullTemplateData = {
    ...templateData,
    confirmation_url: confirmationUrl,
  };

  // Process all template fields
  const processedTemplate = {
    subject: processTemplate(template.subject, fullTemplateData),
    text: processTemplate(template.text, fullTemplateData),
  };

  // Only include HTML if it exists in the template
  if (template.html) {
    processedTemplate.html = processTemplate(template.html, fullTemplateData);
  }

  return processedTemplate;
};

/**
 * Loads and validates a template from a JSON file
 * @param {string} filePath - Path to the template file
 * @returns {Promise<Object>} - Loaded and validated template
 * @throws {Error} - If file cannot be loaded or template is invalid
 */
export const loadTemplate = async filePath => {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');

    let template;
    try {
      template = JSON.parse(fileContent);
    } catch (parseError) {
      throw new Error(`Invalid JSON in template file: ${parseError.message}`);
    }

    // Validate the loaded template
    validateTemplate(template);

    return template;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Template file not found: ${filePath}`);
    }

    // Re-throw validation errors and JSON parse errors
    if (error.message.includes('Template must') || error.message.includes('Invalid JSON')) {
      throw error;
    }

    throw new Error(`Failed to load template: ${error.message}`);
  }
};

/**
 * Gets all variables used across all template fields
 * @param {Object} template - Template object
 * @returns {Array<string>} - Array of unique variable names
 */
export const getAllTemplateVariables = template => {
  const allVariables = new Set();

  // Check all template fields for variables
  const fieldsToCheck = ['subject', 'text', 'html', 'confirmationUrl'];

  fieldsToCheck.forEach(field => {
    if (template[field]) {
      const variables = getTemplateVariables(template[field]);
      variables.forEach(variable => allVariables.add(variable));
    }
  });

  return Array.from(allVariables).sort();
};

/**
 * Validates that subscriber data contains required fields for template
 * @param {Object} subscriber - Subscriber data
 * @param {Object} template - Template object
 * @returns {Object} - Validation result with missing fields
 */
export const validateSubscriberForTemplate = (subscriber, template) => {
  const requiredVariables = getAllTemplateVariables(template);
  const subscriberFields = Object.keys(subscriber);

  // Always required fields
  const alwaysRequired = ['email'];

  // Template-specific required fields (excluding system variables)
  const systemVariables = ['confirmation_token', 'confirmation_url'];
  const templateRequired = requiredVariables.filter(
    variable => !systemVariables.includes(variable),
  );

  const allRequired = [...new Set([...alwaysRequired, ...templateRequired])];
  const missing = allRequired.filter(field => !subscriberFields.includes(field));

  return {
    valid: missing.length === 0,
    missing,
    available: subscriberFields,
    required: allRequired,
  };
};

/**
 * Creates a preview of how the template will look for a subscriber
 * @param {Object} template - Template object
 * @param {Object} subscriber - Subscriber data
 * @returns {Object} - Preview object
 */
export const previewTemplate = (template, subscriber) => {
  const mockToken = 'PREVIEW_TOKEN_123';
  const processed = processTemplateForSubscriber(template, subscriber, mockToken);

  return {
    ...processed,
    variables: getAllTemplateVariables(template),
    validation: validateSubscriberForTemplate(subscriber, template),
  };
};
