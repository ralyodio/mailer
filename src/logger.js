import { promises as fs } from 'fs';
import { dirname } from 'path';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import csvParser from 'csv-parser';

/**
 * Escapes CSV field value to handle commas, quotes, and newlines
 * @param {string} value - Value to escape
 * @returns {string} - Escaped CSV value
 */
const escapeCSVField = value => {
  if (value === null || value === undefined) {
    return '';
  }

  const stringValue = String(value);

  // If the value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

/**
 * Creates a CSV logger instance
 * @param {string} logPath - Path to the log file
 * @returns {Promise<Object>} - Logger instance
 */
export const createLogger = async logPath => {
  // Ensure directory exists
  const logDir = dirname(logPath);
  await fs.mkdir(logDir, { recursive: true });

  // Check if file exists to determine if we need to write headers
  let fileExists = false;
  try {
    await fs.access(logPath);
    fileExists = true;
  } catch {
    // File doesn't exist, we'll create it
  }

  // Create file with headers if it doesn't exist
  if (!fileExists) {
    const headers = 'timestamp,email,status,message_id,error\n';
    await fs.writeFile(logPath, headers);
  }

  return {
    logPath,
    log: async data => {
      const csvLine = `${escapeCSVField(data.timestamp)},${escapeCSVField(data.email)},${escapeCSVField(data.status)},${escapeCSVField(data.message_id)},${escapeCSVField(data.error)}\n`;
      await fs.appendFile(logPath, csvLine);
    },
  };
};

/**
 * Logs an email sending result
 * @param {Object} logger - Logger instance
 * @param {Object} result - Email sending result
 */
export const logEmailResult = async (logger, result) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    email: result.email,
    status: result.success ? 'success' : 'failed',
    message_id: result.messageId || '',
    error: result.error || '',
  };

  await logger.log(logEntry);
};

/**
 * Loads and parses a log file
 * @param {string} logPath - Path to the log file
 * @returns {Promise<Array>} - Array of log entries
 */
export const loadLogFile = async logPath => {
  try {
    await fs.access(logPath);
  } catch (error) {
    throw new Error(`Log file not found: ${logPath}`);
  }

  const results = [];

  await pipeline(
    createReadStream(logPath),
    csvParser({
      skipEmptyLines: true,
      trim: true,
    }),
    async (source) => {
      for await (const chunk of source) {
        results.push(chunk);
      }
    },
  );

  return results;
};

/**
 * Calculates statistics from log data
 * @param {Array} logData - Array of log entries
 * @returns {Object} - Statistics object
 */
export const getLogStats = logData => {
  const total = logData.length;
  const successful = logData.filter(entry => entry.status === 'success').length;
  const failed = total - successful;
  const successRate = total > 0 ? Math.round((successful / total) * 100 * 100) / 100 : 0;

  return {
    total,
    successful,
    failed,
    successRate,
  };
};

/**
 * Formats duration in human-readable format
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} - Formatted duration
 */
const formatDuration = milliseconds => {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Generates a summary report from log data
 * @param {Array} logData - Array of log entries
 * @returns {string} - Summary report
 */
export const generateSummaryReport = logData => {
  const stats = getLogStats(logData);

  let report = `${'='.repeat(50)}\n`;
  report += 'Email Sending Summary Report\n';
  report += `${'='.repeat(50)}\n\n`;

  if (stats.total === 0) {
    report += 'No emails were processed.\n';
    return report;
  }

  report += `Total emails processed: ${stats.total}\n`;
  report += `Successful: ${stats.successful}\n`;
  report += `Failed: ${stats.failed}\n`;
  report += `Success rate: ${stats.successRate}%\n\n`;

  // Add timing information if available
  if (logData.length > 0) {
    const timestamps = logData
      .map(entry => new Date(entry.timestamp))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (timestamps.length > 0) {
      const startTime = timestamps[0];
      const endTime = timestamps[timestamps.length - 1];
      const duration = endTime.getTime() - startTime.getTime();

      report += 'Timing Information:\n';
      report += `${'-'.repeat(20)}\n`;
      report += `Started at: ${startTime.toISOString()}\n`;
      report += `Completed at: ${endTime.toISOString()}\n`;
      report += `Duration: ${formatDuration(duration)}\n\n`;
    }
  }

  // Add failure details if any
  if (stats.failed > 0) {
    const failedEntries = logData.filter(entry => entry.status === 'failed');
    const errorCounts = {};

    failedEntries.forEach(entry => {
      const error = entry.error || 'Unknown error';
      errorCounts[error] = (errorCounts[error] || 0) + 1;
    });

    report += 'Failure Analysis:\n';
    report += `${'-'.repeat(20)}\n`;
    Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([error, count]) => {
        report += `${error}: ${count} occurrence${count > 1 ? 's' : ''}\n`;
      });
    report += '\n';
  }

  report += `${'='.repeat(50)}\n`;

  return report;
};

/**
 * Exports email results to a CSV file
 * @param {Array} results - Array of email results
 * @param {string} outputPath - Output file path
 */
export const exportResultsToCSV = async (results, outputPath) => {
  // Ensure directory exists
  const outputDir = dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  // Create CSV content
  let csvContent = 'timestamp,email,status,message_id,error\n';

  for (const result of results) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      email: result.email,
      status: result.success ? 'success' : 'failed',
      message_id: result.messageId || '',
      error: result.error || '',
    };

    csvContent += `${escapeCSVField(logEntry.timestamp)},${escapeCSVField(logEntry.email)},${escapeCSVField(logEntry.status)},${escapeCSVField(logEntry.message_id)},${escapeCSVField(logEntry.error)}\n`;
  }

  await fs.writeFile(outputPath, csvContent);
};

/**
 * Filters log data by date range
 * @param {Array} logData - Array of log entries
 * @param {Date} startDate - Start date (inclusive)
 * @param {Date} endDate - End date (inclusive)
 * @returns {Array} - Filtered log entries
 */
export const filterLogsByDateRange = (logData, startDate, endDate) => {
  return logData.filter(entry => {
    const entryDate = new Date(entry.timestamp);
    return entryDate >= startDate && entryDate <= endDate;
  });
};

/**
 * Groups log data by status
 * @param {Array} logData - Array of log entries
 * @returns {Object} - Grouped log entries
 */
export const groupLogsByStatus = logData => {
  return logData.reduce((groups, entry) => {
    const status = entry.status || 'unknown';
    if (!groups[status]) {
      groups[status] = [];
    }
    groups[status].push(entry);
    return groups;
  }, {});
};

/**
 * Gets unique error messages from failed log entries
 * @param {Array} logData - Array of log entries
 * @returns {Array} - Array of unique error messages
 */
export const getUniqueErrors = logData => {
  const failedEntries = logData.filter(entry => entry.status === 'failed');
  const errors = failedEntries.map(entry => entry.error || 'Unknown error');
  return [...new Set(errors)].sort();
};

/**
 * Validates log file format
 * @param {string} logPath - Path to the log file
 * @returns {Promise<Object>} - Validation result
 */
export const validateLogFile = async logPath => {
  try {
    const logData = await loadLogFile(logPath);
    const requiredFields = ['timestamp', 'email', 'status'];

    if (logData.length === 0) {
      return { valid: true, message: 'Log file is empty but valid' };
    }

    // Check if all entries have required fields
    const invalidEntries = logData.filter(
      entry => !requiredFields.every(field => entry.hasOwnProperty(field)),
    );

    if (invalidEntries.length > 0) {
      return {
        valid: false,
        message: `${invalidEntries.length} entries missing required fields`,
        invalidEntries: invalidEntries.slice(0, 5), // Show first 5 invalid entries
      };
    }

    return {
      valid: true,
      message: `Log file is valid with ${logData.length} entries`,
      stats: getLogStats(logData),
    };
  } catch (error) {
    return {
      valid: false,
      message: `Log file validation failed: ${error.message}`,
    };
  }
};
