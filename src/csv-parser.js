import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import csvParser from 'csv-parser';

/**
 * Validates an email address using a comprehensive regex pattern
 * @param {string} email - The email address to validate
 * @returns {boolean} - True if email is valid, false otherwise
 */
export const validateEmail = email => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Comprehensive email validation regex
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  // Additional checks for edge cases
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
    return false;
  }

  if (email.includes(' ')) {
    return false;
  }

  return emailRegex.test(email.trim());
};

/**
 * Validates the structure of parsed CSV data and filters out invalid emails
 * @param {Array<Object>} data - Array of CSV row objects
 * @returns {Object} - Object containing valid data and skipped emails info
 * @throws {Error} - If validation fails
 */
export const validateCSVStructure = data => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Check if email column exists (support both formats)
  const firstRow = data[0];
  const emailField = firstRow.Email || firstRow.email;
  if (!emailField && !Object.prototype.hasOwnProperty.call(firstRow, 'Email') && !Object.prototype.hasOwnProperty.call(firstRow, 'email')) {
    throw new Error('CSV must contain an "Email" or "email" column');
  }

  // Filter out invalid email addresses and collect skipped emails
  const validData = [];
  const skippedEmails = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const email = (row.Email || row.email)?.trim();

    if (!validateEmail(email)) {
      skippedEmails.push({
        rowNumber: i + 1,
        email: email || 'empty',
        reason: 'Invalid email format'
      });
    } else {
      validData.push(row);
    }
  }

  return {
    validData,
    skippedEmails,
    totalRows: data.length,
    validRows: validData.length,
    skippedRows: skippedEmails.length
  };
};

/**
 * Parses a CSV file and returns validated subscriber data
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Object>} - Object containing valid subscribers and skipped emails info
 * @throws {Error} - If file cannot be read or data is invalid
 */
export const parseCSV = async filePath => {
  const results = [];

  try {
    await pipeline(
      createReadStream(filePath),
      csvParser({
        skipEmptyLines: true,
        trim: true,
      }),
      async function* (source) {
        for await (const chunk of source) {
          // Trim all string values and normalize the data
          const normalizedChunk = {};
          for (const [key, value] of Object.entries(chunk)) {
            normalizedChunk[key] = typeof value === 'string' ? value.trim() : value;
          }
          
          // Normalize field names for template compatibility
          // Map new format (FirstName, LastName, Email) to template placeholders
          if (normalizedChunk.FirstName !== undefined) {
            normalizedChunk.firstName = normalizedChunk.FirstName;
          }
          if (normalizedChunk.LastName !== undefined) {
            normalizedChunk.lastName = normalizedChunk.LastName;
          }
          if (normalizedChunk.Email !== undefined) {
            normalizedChunk.email = normalizedChunk.Email;
          }
          
          yield normalizedChunk;
        }
      },
      async (source) => {
        for await (const chunk of source) {
          results.push(chunk);
        }
      },
    );

    // Validate the parsed data structure and filter invalid emails
    const validationResult = validateCSVStructure(results);

    return validationResult;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`CSV file not found: ${filePath}`);
    }

    if (
      error.message.includes('CSV must contain') ||
      error.message.includes('CSV file is empty')
    ) {
      throw error;
    }

    throw new Error(`Failed to parse CSV file: ${error.message}`);
  }
};

/**
 * Gets statistics about the parsed CSV data
 * @param {Array<Object>} data - Array of subscriber objects
 * @returns {Object} - Statistics object
 */
export const getCSVStats = data => {
  const totalSubscribers = data.length;
  const withFirstName = data.filter(row => (row.FirstName || row.first_name)?.trim()).length;
  const withLastName = data.filter(row => (row.LastName || row.last_name)?.trim()).length;
  const withFullName = data.filter(row =>
    (row.FirstName || row.first_name)?.trim() && (row.LastName || row.last_name)?.trim()
  ).length;

  return {
    totalSubscribers,
    withFirstName,
    withLastName,
    withFullName,
    emailOnly: totalSubscribers - withFirstName,
  };
};
