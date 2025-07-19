import { expect } from 'chai';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  parseArguments,
  validateArguments,
  showHelp,
  showVersion,
  loadConfiguration,
  validateConfiguration,
} from '../src/cli.js';

describe('CLI Module', () => {
  const testDataDir = join(process.cwd(), 'test', 'fixtures');

  before(async () => {
    // Create test fixtures directory
    await fs.mkdir(testDataDir, { recursive: true });
  });

  after(async () => {
    // Clean up test fixtures
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('parseArguments', () => {
    it('should parse basic command line arguments', () => {
      const argv = [
        'node',
        'index.js',
        '--csv=subscribers.csv',
        '--template=template.json',
        '--output=results.csv',
      ];

      const args = parseArguments(argv);

      expect(args).to.deep.equal({
        csv: 'subscribers.csv',
        template: 'template.json',
        output: 'results.csv',
      });
    });

    it('should parse arguments with equals sign', () => {
      const argv = [
        'node',
        'index.js',
        '--csv=data/subscribers.csv',
        '--template=config/template.json',
      ];

      const args = parseArguments(argv);

      expect(args.csv).to.equal('data/subscribers.csv');
      expect(args.template).to.equal('config/template.json');
    });

    it('should parse arguments with space separation', () => {
      const argv = ['node', 'index.js', '--csv', 'subscribers.csv', '--template', 'template.json'];

      const args = parseArguments(argv);

      expect(args.csv).to.equal('subscribers.csv');
      expect(args.template).to.equal('template.json');
    });

    it('should handle boolean flags', () => {
      const argv = [
        'node',
        'index.js',
        '--csv=test.csv',
        '--template=test.json',
        '--dry-run',
        '--verbose',
      ];

      const args = parseArguments(argv);

      expect(args['dry-run']).to.be.true;
      expect(args.verbose).to.be.true;
    });

    it('should handle short flags', () => {
      const argv = [
        'node',
        'index.js',
        '-c',
        'subscribers.csv',
        '-t',
        'template.json',
        '-o',
        'output.csv',
        '-v',
      ];

      const args = parseArguments(argv);

      expect(args.c).to.equal('subscribers.csv');
      expect(args.t).to.equal('template.json');
      expect(args.o).to.equal('output.csv');
      expect(args.v).to.be.true;
    });

    it('should handle help and version flags', () => {
      const helpArgs = parseArguments(['node', 'index.js', '--help']);
      const versionArgs = parseArguments(['node', 'index.js', '--version']);

      expect(helpArgs.help).to.be.true;
      expect(versionArgs.version).to.be.true;
    });

    it('should handle mixed argument styles', () => {
      const argv = [
        'node',
        'index.js',
        '--csv=subscribers.csv',
        '-t',
        'template.json',
        '--output',
        'results.csv',
        '--verbose',
      ];

      const args = parseArguments(argv);

      expect(args.csv).to.equal('subscribers.csv');
      expect(args.t).to.equal('template.json');
      expect(args.output).to.equal('results.csv');
      expect(args.verbose).to.be.true;
    });
  });

  describe('validateArguments', () => {
    it('should validate complete required arguments', () => {
      const args = {
        csv: 'subscribers.csv',
        template: 'template.json',
        output: 'results.csv',
      };

      const result = validateArguments(args);

      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should require CSV file argument', () => {
      const args = {
        template: 'template.json',
        output: 'results.csv',
      };

      const result = validateArguments(args);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('CSV file path is required (--csv)');
    });

    it('should require template file argument', () => {
      const args = {
        csv: 'subscribers.csv',
        output: 'results.csv',
      };

      const result = validateArguments(args);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Template file path is required (--template)');
    });

    it('should require output file argument', () => {
      const args = {
        csv: 'subscribers.csv',
        template: 'template.json',
      };

      const result = validateArguments(args);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Output file path is required (--output)');
    });

    it('should validate file extensions', () => {
      const args = {
        csv: 'subscribers.txt',
        template: 'template.xml',
        output: 'results.log',
      };

      const result = validateArguments(args);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('CSV file must have .csv extension');
      expect(result.errors).to.include('Template file must have .json extension');
      expect(result.errors).to.include('Output file must have .csv extension');
    });

    it('should handle help and version flags without validation', () => {
      const helpArgs = { help: true };
      const versionArgs = { version: true };

      expect(validateArguments(helpArgs).valid).to.be.true;
      expect(validateArguments(versionArgs).valid).to.be.true;
    });

    it('should validate rate limit parameter', () => {
      const args = {
        csv: 'subscribers.csv',
        template: 'template.json',
        output: 'results.csv',
        'rate-limit': 'invalid',
      };

      const result = validateArguments(args);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Rate limit must be a positive number');
    });

    it('should accept valid rate limit parameter', () => {
      const args = {
        csv: 'subscribers.csv',
        template: 'template.json',
        output: 'results.csv',
        'rate-limit': '5',
      };

      const result = validateArguments(args);

      expect(result.valid).to.be.true;
    });
  });

  describe('showHelp', () => {
    it('should return help text', () => {
      const helpText = showHelp();

      expect(helpText).to.be.a('string');
      expect(helpText).to.include('Usage:');
      expect(helpText).to.include('--csv');
      expect(helpText).to.include('--template');
      expect(helpText).to.include('--output');
      expect(helpText).to.include('Examples:');
    });

    it('should include all available options', () => {
      const helpText = showHelp();

      expect(helpText).to.include('--dry-run');
      expect(helpText).to.include('--rate-limit');
      expect(helpText).to.include('--verbose');
      expect(helpText).to.include('--help');
      expect(helpText).to.include('--version');
    });
  });

  describe('showVersion', () => {
    it('should return version information', () => {
      const versionText = showVersion();

      expect(versionText).to.be.a('string');
      expect(versionText).to.include('mailgun-optin-cli');
      expect(versionText).to.match(/\d+\.\d+\.\d+/); // Version pattern
    });
  });

  describe('loadConfiguration', () => {
    beforeEach(async () => {
      // Create test .env file
      const envContent = `MAILGUN_API_KEY=test-api-key
MAILGUN_DOMAIN=test.mailgun.org
FROM_EMAIL=noreply@test.com
FROM_NAME=Test Company
CONFIRMATION_BASE_URL=https://test.com/confirm
RATE_LIMIT=10`;

      await fs.writeFile(join(testDataDir, '.env'), envContent);
    });

    it('should load configuration from environment variables', () => {
      // Set environment variables
      process.env.MAILGUN_API_KEY = 'env-api-key';
      process.env.MAILGUN_DOMAIN = 'env.mailgun.org';
      process.env.FROM_EMAIL = 'env@test.com';

      const config = loadConfiguration();

      expect(config.mailgun.apiKey).to.equal('env-api-key');
      expect(config.mailgun.domain).to.equal('env.mailgun.org');
      expect(config.mailgun.fromEmail).to.equal('env@test.com');

      // Clean up
      delete process.env.MAILGUN_API_KEY;
      delete process.env.MAILGUN_DOMAIN;
      delete process.env.FROM_EMAIL;
    });

    it('should use default values for missing configuration', () => {
      // Clear environment variables
      delete process.env.MAILGUN_API_KEY;
      delete process.env.FROM_NAME;
      delete process.env.RATE_LIMIT;

      const config = loadConfiguration();

      expect(config.mailgun.fromName).to.equal('Mailer');
      expect(config.rateLimit).to.equal(10);
    });

    it('should override configuration with command line arguments', () => {
      const args = {
        'rate-limit': '5',
        'from-email': 'cli@test.com',
      };

      const config = loadConfiguration(args);

      expect(config.rateLimit).to.equal(5);
      expect(config.mailgun.fromEmail).to.equal('cli@test.com');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate complete configuration', () => {
      const config = {
        mailgun: {
          apiKey: 'test-api-key',
          domain: 'test.mailgun.org',
          fromEmail: 'noreply@test.com',
          fromName: 'Test Company',
        },
        confirmationBaseUrl: 'https://test.com/confirm',
        rateLimit: 10,
      };

      const result = validateConfiguration(config);

      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
    });

    it('should require Mailgun API key', () => {
      const config = {
        mailgun: {
          domain: 'test.mailgun.org',
          fromEmail: 'noreply@test.com',
        },
        confirmationBaseUrl: 'https://test.com/confirm',
      };

      const result = validateConfiguration(config);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Mailgun API key is required');
    });

    it('should require Mailgun domain', () => {
      const config = {
        mailgun: {
          apiKey: 'test-api-key',
          fromEmail: 'noreply@test.com',
        },
        confirmationBaseUrl: 'https://test.com/confirm',
      };

      const result = validateConfiguration(config);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Mailgun domain is required');
    });

    it('should require from email address', () => {
      const config = {
        mailgun: {
          apiKey: 'test-api-key',
          domain: 'test.mailgun.org',
        },
        confirmationBaseUrl: 'https://test.com/confirm',
      };

      const result = validateConfiguration(config);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('From email address is required');
    });

    it('should validate email format', () => {
      const config = {
        mailgun: {
          apiKey: 'test-api-key',
          domain: 'test.mailgun.org',
          fromEmail: 'invalid-email',
        },
        confirmationBaseUrl: 'https://test.com/confirm',
      };

      const result = validateConfiguration(config);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('From email address is invalid');
    });

    it('should require confirmation base URL', () => {
      const config = {
        mailgun: {
          apiKey: 'test-api-key',
          domain: 'test.mailgun.org',
          fromEmail: 'noreply@test.com',
        },
      };

      const result = validateConfiguration(config);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Confirmation base URL is required');
    });

    it('should validate URL format', () => {
      const config = {
        mailgun: {
          apiKey: 'test-api-key',
          domain: 'test.mailgun.org',
          fromEmail: 'noreply@test.com',
        },
        confirmationBaseUrl: 'invalid-url',
      };

      const result = validateConfiguration(config);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Confirmation base URL is invalid');
    });

    it('should validate rate limit', () => {
      const config = {
        mailgun: {
          apiKey: 'test-api-key',
          domain: 'test.mailgun.org',
          fromEmail: 'noreply@test.com',
        },
        confirmationBaseUrl: 'https://test.com/confirm',
        rateLimit: -1,
      };

      const result = validateConfiguration(config);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Rate limit must be a positive number');
    });
  });

  describe('Argument Mapping', () => {
    it('should map short flags to long flags', () => {
      const args = parseArguments([
        'node',
        'index.js',
        '-c',
        'test.csv',
        '-t',
        'test.json',
        '-o',
        'output.csv',
        '-v',
        '-h',
      ]);

      // Should map short flags appropriately
      expect(args.c).to.equal('test.csv');
      expect(args.t).to.equal('test.json');
      expect(args.o).to.equal('output.csv');
      expect(args.v).to.be.true;
      expect(args.h).to.be.true;
    });

    it('should handle conflicting short and long flags', () => {
      const args = parseArguments(['node', 'index.js', '--csv=long.csv', '-c', 'short.csv']);

      // Last one should win
      expect(args.c).to.equal('short.csv');
      expect(args.csv).to.equal('long.csv');
    });
  });
});
