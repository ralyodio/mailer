import { expect } from 'chai';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  createLogger,
  logEmailResult,
  generateSummaryReport,
  exportResultsToCSV,
  loadLogFile,
  getLogStats,
} from '../src/logger.js';

describe('Logger Module', () => {
  const testDataDir = join(process.cwd(), 'test', 'fixtures');
  const testLogFile = join(testDataDir, 'test-log.csv');

  before(async () => {
    // Create test fixtures directory
    await fs.mkdir(testDataDir, { recursive: true });
  });

  after(async () => {
    // Clean up test fixtures
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Clean up any existing test log file
    try {
      await fs.unlink(testLogFile);
    } catch (error) {
      // File doesn't exist, ignore
    }
  });

  describe('createLogger', () => {
    it('should create logger with valid file path', async () => {
      const logger = await createLogger(testLogFile);

      expect(logger).to.be.an('object');
      expect(logger).to.have.property('logPath', testLogFile);
      expect(logger).to.have.property('log');
      expect(logger.log).to.be.a('function');
    });

    it('should create CSV file with headers', async () => {
      await createLogger(testLogFile);

      const fileExists = await fs
        .access(testLogFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).to.be.true;

      const content = await fs.readFile(testLogFile, 'utf8');
      expect(content).to.include('timestamp,email,status,message_id,error');
    });

    it('should create directory if it does not exist', async () => {
      const nestedLogFile = join(testDataDir, 'nested', 'dir', 'log.csv');
      const logger = await createLogger(nestedLogFile);

      expect(logger.logPath).to.equal(nestedLogFile);

      const fileExists = await fs
        .access(nestedLogFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).to.be.true;
    });

    it('should append to existing file without duplicating headers', async () => {
      // Create logger first time
      await createLogger(testLogFile);
      const firstContent = await fs.readFile(testLogFile, 'utf8');

      // Create logger second time
      await createLogger(testLogFile);
      const secondContent = await fs.readFile(testLogFile, 'utf8');

      // Should not have duplicate headers
      const headerCount = (secondContent.match(/timestamp,email,status/g) || []).length;
      expect(headerCount).to.equal(1);
    });
  });

  describe('logEmailResult', () => {
    let logger;

    beforeEach(async () => {
      logger = await createLogger(testLogFile);
    });

    it('should log successful email result', async () => {
      const result = {
        email: 'test@example.com',
        success: true,
        messageId: '<test-message-id@mailgun.org>',
      };

      await logEmailResult(logger, result);

      const content = await fs.readFile(testLogFile, 'utf8');
      expect(content).to.include('test@example.com');
      expect(content).to.include('success');
      expect(content).to.include('<test-message-id@mailgun.org>');
    });

    it('should log failed email result', async () => {
      const result = {
        email: 'failed@example.com',
        success: false,
        error: 'Invalid email address',
      };

      await logEmailResult(logger, result);

      const content = await fs.readFile(testLogFile, 'utf8');
      expect(content).to.include('failed@example.com');
      expect(content).to.include('failed');
      expect(content).to.include('Invalid email address');
    });

    it('should handle special characters in email and error messages', async () => {
      const result = {
        email: 'user+tag@example.com',
        success: false,
        error: 'Error with "quotes" and, commas',
      };

      await logEmailResult(logger, result);

      const content = await fs.readFile(testLogFile, 'utf8');
      expect(content).to.include('user+tag@example.com');
      expect(content).to.include('"Error with ""quotes"" and, commas"');
    });

    it('should include timestamp in log entries', async () => {
      const result = {
        email: 'timestamp@example.com',
        success: true,
        messageId: 'test-id',
      };

      const beforeTime = new Date();
      await logEmailResult(logger, result);
      const afterTime = new Date();

      const content = await fs.readFile(testLogFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      const lastLine = lines[lines.length - 1];

      // Extract timestamp from CSV
      const timestamp = lastLine.split(',')[0];
      const logTime = new Date(timestamp);

      expect(logTime.getTime()).to.be.at.least(beforeTime.getTime());
      expect(logTime.getTime()).to.be.at.most(afterTime.getTime());
    });

    it('should handle multiple log entries', async () => {
      const results = [
        { email: 'user1@example.com', success: true, messageId: 'id1' },
        { email: 'user2@example.com', success: false, error: 'Error 2' },
        { email: 'user3@example.com', success: true, messageId: 'id3' },
      ];

      for (const result of results) {
        await logEmailResult(logger, result);
      }

      const content = await fs.readFile(testLogFile, 'utf8');
      expect(content).to.include('user1@example.com');
      expect(content).to.include('user2@example.com');
      expect(content).to.include('user3@example.com');

      const lines = content.split('\n').filter(line => line.trim());
      expect(lines).to.have.length(4); // Header + 3 data lines
    });
  });

  describe('loadLogFile', () => {
    let logger;

    beforeEach(async () => {
      logger = await createLogger(testLogFile);

      // Add some test data
      const testResults = [
        { email: 'success1@example.com', success: true, messageId: 'id1' },
        { email: 'failed1@example.com', success: false, error: 'Error 1' },
        { email: 'success2@example.com', success: true, messageId: 'id2' },
      ];

      for (const result of testResults) {
        await logEmailResult(logger, result);
      }
    });

    it('should load and parse log file', async () => {
      const logData = await loadLogFile(testLogFile);

      expect(logData).to.be.an('array');
      expect(logData).to.have.length(3);

      expect(logData[0]).to.have.property('email', 'success1@example.com');
      expect(logData[0]).to.have.property('status', 'success');
      expect(logData[1]).to.have.property('email', 'failed1@example.com');
      expect(logData[1]).to.have.property('status', 'failed');
    });

    it('should throw error for non-existent file', async () => {
      const nonExistentFile = join(testDataDir, 'non-existent.csv');

      try {
        await loadLogFile(nonExistentFile);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Log file not found');
      }
    });

    it('should handle empty log file', async () => {
      const emptyLogFile = join(testDataDir, 'empty.csv');
      await fs.writeFile(emptyLogFile, 'timestamp,email,status,message_id,error\n');

      const logData = await loadLogFile(emptyLogFile);
      expect(logData).to.be.an('array');
      expect(logData).to.have.length(0);
    });
  });

  describe('getLogStats', () => {
    it('should calculate statistics from log data', () => {
      const logData = [
        { email: 'user1@example.com', status: 'success', message_id: 'id1' },
        { email: 'user2@example.com', status: 'failed', error: 'Error' },
        { email: 'user3@example.com', status: 'success', message_id: 'id3' },
        { email: 'user4@example.com', status: 'failed', error: 'Error' },
        { email: 'user5@example.com', status: 'success', message_id: 'id5' },
      ];

      const stats = getLogStats(logData);

      expect(stats).to.deep.equal({
        total: 5,
        successful: 3,
        failed: 2,
        successRate: 60,
      });
    });

    it('should handle empty log data', () => {
      const stats = getLogStats([]);

      expect(stats).to.deep.equal({
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 0,
      });
    });

    it('should handle all successful emails', () => {
      const logData = [{ status: 'success' }, { status: 'success' }, { status: 'success' }];

      const stats = getLogStats(logData);

      expect(stats.successRate).to.equal(100);
    });

    it('should handle all failed emails', () => {
      const logData = [{ status: 'failed' }, { status: 'failed' }];

      const stats = getLogStats(logData);

      expect(stats.successRate).to.equal(0);
    });
  });

  describe('generateSummaryReport', () => {
    it('should generate summary report from log data', () => {
      const logData = [
        {
          timestamp: '2024-01-01T10:00:00.000Z',
          email: 'user1@example.com',
          status: 'success',
          message_id: 'id1',
        },
        {
          timestamp: '2024-01-01T10:01:00.000Z',
          email: 'user2@example.com',
          status: 'failed',
          error: 'Invalid email',
        },
      ];

      const report = generateSummaryReport(logData);

      expect(report).to.be.a('string');
      expect(report).to.include('Email Sending Summary Report');
      expect(report).to.include('Total emails processed: 2');
      expect(report).to.include('Successful: 1');
      expect(report).to.include('Failed: 1');
      expect(report).to.include('Success rate: 50%');
    });

    it('should include timing information in report', () => {
      const logData = [
        {
          timestamp: '2024-01-01T10:00:00.000Z',
          email: 'user1@example.com',
          status: 'success',
        },
        {
          timestamp: '2024-01-01T10:05:00.000Z',
          email: 'user2@example.com',
          status: 'success',
        },
      ];

      const report = generateSummaryReport(logData);

      expect(report).to.include('Started at:');
      expect(report).to.include('Completed at:');
      expect(report).to.include('Duration:');
    });

    it('should handle empty log data', () => {
      const report = generateSummaryReport([]);

      expect(report).to.include('Total emails processed: 0');
      expect(report).to.include('No emails were processed');
    });
  });

  describe('exportResultsToCSV', () => {
    it('should export results to CSV format', async () => {
      const results = [
        { email: 'user1@example.com', success: true, messageId: 'id1' },
        { email: 'user2@example.com', success: false, error: 'Error message' },
      ];

      const outputFile = join(testDataDir, 'export-test.csv');
      await exportResultsToCSV(results, outputFile);

      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).to.include('timestamp,email,status,message_id,error');
      expect(content).to.include('user1@example.com');
      expect(content).to.include('user2@example.com');
      expect(content).to.include('success');
      expect(content).to.include('failed');
    });

    it('should create directory if it does not exist', async () => {
      const results = [{ email: 'test@example.com', success: true, messageId: 'id1' }];

      const nestedOutputFile = join(testDataDir, 'nested', 'export', 'results.csv');
      await exportResultsToCSV(results, nestedOutputFile);

      const fileExists = await fs
        .access(nestedOutputFile)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).to.be.true;
    });

    it('should handle empty results array', async () => {
      const outputFile = join(testDataDir, 'empty-export.csv');
      await exportResultsToCSV([], outputFile);

      const content = await fs.readFile(outputFile, 'utf8');
      expect(content).to.equal('timestamp,email,status,message_id,error\n');
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end with logging and reporting', async () => {
      const logger = await createLogger(testLogFile);

      // Simulate email sending results
      const emailResults = [
        { email: 'success1@example.com', success: true, messageId: 'msg1' },
        { email: 'success2@example.com', success: true, messageId: 'msg2' },
        { email: 'failed1@example.com', success: false, error: 'Bounce' },
      ];

      // Log all results
      for (const result of emailResults) {
        await logEmailResult(logger, result);
      }

      // Load and analyze
      const logData = await loadLogFile(testLogFile);
      const stats = getLogStats(logData);
      const report = generateSummaryReport(logData);

      expect(stats.total).to.equal(3);
      expect(stats.successful).to.equal(2);
      expect(stats.failed).to.equal(1);
      expect(stats.successRate).to.be.closeTo(66.67, 0.1);

      expect(report).to.include('Total emails processed: 3');
      expect(report).to.include('Successful: 2');
      expect(report).to.include('Failed: 1');
    });
  });
});
