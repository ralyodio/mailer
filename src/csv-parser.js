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
 * Validates the structure of parsed CSV data
 * @param {Array<Object>} data - Array of CSV row objects
 * @throws {Error} - If validation fails
 */
export const validateCSVStructure = data => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Check if email column exists
  const firstRow = data[0];
  if (!Object.prototype.hasOwnProperty.call(firstRow, 'email')) {
    throw new Error('CSV must contain an "email" column');
  }

  // Validate all email addresses
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const email = row.email?.trim();

    if (!validateEmail(email)) {
      throw new Error(`Invalid email address found: ${email || 'empty'}`);
    }
  }
};

/**
 * Parses a CSV file and returns validated subscriber data
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Array<Object>>} - Array of subscriber objects
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
          yield normalizedChunk;
        }
      },
      async (source) => {
        for await (const chunk of source) {
          results.push(chunk);
        }
      },
    );

    // Validate the parsed data structure
    validateCSVStructure(results);

    return results;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`CSV file not found: ${filePath}`);
    }

    if (
      error.message.includes('Invalid email') ||
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
  const withFirstName = data.filter(row => row.first_name?.trim()).length;
  const withLastName = data.filter(row => row.last_name?.trim()).length;
  const withFullName = data.filter(row => row.first_name?.trim() && row.last_name?.trim()).length;

  return {
    totalSubscribers,
    withFirstName,
    withLastName,
    withFullName,
    emailOnly: totalSubscribers - withFirstName,
  };
};
