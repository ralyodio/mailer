import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, URL } from 'url';
import dotenv from 'dotenv';
import { validateEmail } from './csv-parser.js';

// Load environment variables
dotenv.config();

// Get package.json for version info
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));

/**
 * Parses command line arguments
 * @param {Array<string>} argv - Command line arguments
 * @returns {Object} - Parsed arguments object
 */
export const parseArguments = argv => {
  const args = {};

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      // Long flag format: --flag=value or --flag value
      if (arg.includes('=')) {
        const [key, value] = arg.substring(2).split('=', 2);
        args[key] = value;
      } else {
        const key = arg.substring(2);
        // Check if next argument is a value (doesn't start with -)
        if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
          args[key] = argv[i + 1];
          i++; // Skip next argument as it's the value
        } else {
          args[key] = true; // Boolean flag
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      // Short flag format: -f value or -f
      const key = arg.substring(1);
      // Check if next argument is a value (doesn't start with -)
      if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        args[key] = argv[i + 1];
        i++; // Skip next argument as it's the value
      } else {
        args[key] = true; // Boolean flag
      }
    }
  }

  return args;
};

/**
 * Validates parsed command line arguments
 * @param {Object} args - Parsed arguments
 * @returns {Object} - Validation result
 */
export const validateArguments = args => {
  const errors = [];

  // Skip validation for help and version flags
  if (args.help || args.h || args.version || args.v) {
    return { valid: true, errors: [] };
  }

  // Required arguments
  if (!args.csv && !args.c) {
    errors.push('CSV file path is required (--csv)');
  }

  if (!args.template && !args.t) {
    errors.push('Template file path is required (--template)');
  }

  if (!args.output && !args.o) {
    errors.push('Output file path is required (--output)');
  }

  // File extension validation
  const csvFile = args.csv || args.c;
  if (csvFile && !csvFile.endsWith('.csv')) {
    errors.push('CSV file must have .csv extension');
  }

  const templateFile = args.template || args.t;
  if (templateFile && !templateFile.endsWith('.json')) {
    errors.push('Template file must have .json extension');
  }

  const outputFile = args.output || args.o;
  if (outputFile && !outputFile.endsWith('.csv')) {
    errors.push('Output file must have .csv extension');
  }

  // Rate limit validation
  const rateLimit = args['rate-limit'];
  if (rateLimit !== undefined) {
    const rateLimitNum = Number(rateLimit);
    if (isNaN(rateLimitNum) || rateLimitNum <= 0) {
      errors.push('Rate limit must be a positive number');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Shows help information
 * @returns {string} - Help text
 */
export const showHelp = () => {
  return `
${packageJson.name} v${packageJson.version}
${packageJson.description}

Usage:
  mailer send --csv=<file> --template=<file> --output=<file> [options]

Required Arguments:
  --csv, -c <file>        Path to CSV file containing subscriber data
  --template, -t <file>   Path to JSON template file for email content
  --output, -o <file>     Path to output CSV file for logging results

Options:
  --rate-limit <number>   Emails per second (default: 10)
  --dry-run              Preview emails without sending
  --verbose, -v          Enable verbose logging
  --help, -h             Show this help message
  --version              Show version information

Environment Variables:
  MAILGUN_API_KEY        Your Mailgun API key (required)
  MAILGUN_DOMAIN         Your Mailgun domain (required)
  FROM_EMAIL             From email address (required)
  FROM_NAME              From name (default: "Mailer")
  CONFIRMATION_BASE_URL  Base URL for confirmation links (required)
  RATE_LIMIT             Default rate limit (default: 10)

Examples:
  # Basic usage
  mailer send --csv=subscribers.csv --template=templates/welcome.json --output=results.csv

  # With custom rate limiting
  mailer send --csv=list.csv --template=templates/confirm.json --output=log.csv --rate-limit=5

  # Dry run to preview emails
  mailer send --csv=test.csv --template=templates/template.json --output=preview.csv --dry-run

  # Verbose output
  mailer send --csv=data.csv --template=templates/email.json --output=results.csv --verbose

For more information, visit: ${packageJson.homepage || 'https://github.com/username/mailgun-optin-cli'}
`;
};

/**
 * Shows version information
 * @returns {string} - Version text
 */
export const showVersion = () => {
  return `${packageJson.name} v${packageJson.version}`;
};

/**
 * Loads configuration from environment variables and command line arguments
 * @param {Object} args - Command line arguments (optional)
 * @returns {Object} - Configuration object
 */
export const loadConfiguration = (args = {}) => {
  const config = {
    mailgun: {
      apiKey: process.env.MAILGUN_API_KEY || args['api-key'],
      domain: process.env.MAILGUN_DOMAIN || args.domain,
      fromEmail: process.env.FROM_EMAIL || args['from-email'],
      fromName: process.env.FROM_NAME || args['from-name'] || 'Mailer',
    },
    confirmationBaseUrl: process.env.CONFIRMATION_BASE_URL || args['confirmation-url'],
    rateLimit: parseInt(args['rate-limit'] || process.env.RATE_LIMIT || '10', 10),
    dryRun: args['dry-run'] || false,
    verbose: args.verbose || args.v || false,
  };

  return config;
};

/**
 * Validates configuration object
 * @param {Object} config - Configuration to validate
 * @returns {Object} - Validation result
 */
export const validateConfiguration = config => {
  const errors = [];

  // Mailgun configuration
  if (!config.mailgun.apiKey) {
    errors.push('Mailgun API key is required');
  }

  if (!config.mailgun.domain) {
    errors.push('Mailgun domain is required');
  }

  if (!config.mailgun.fromEmail) {
    errors.push('From email address is required');
  } else if (!validateEmail(config.mailgun.fromEmail)) {
    errors.push('From email address is invalid');
  }

  // Confirmation URL
  if (!config.confirmationBaseUrl) {
    errors.push('Confirmation base URL is required');
  } else {
    try {
      new URL(config.confirmationBaseUrl);
    } catch {
      errors.push('Confirmation base URL is invalid');
    }
  }

  // Rate limit
  if (config.rateLimit <= 0) {
    errors.push('Rate limit must be a positive number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Normalizes arguments by mapping short flags to long flags
 * @param {Object} args - Raw parsed arguments
 * @returns {Object} - Normalized arguments
 */
export const normalizeArguments = args => {
  const normalized = { ...args };

  // Map short flags to long flags for easier access
  const flagMappings = {
    c: 'csv',
    t: 'template',
    o: 'output',
    v: 'verbose',
    h: 'help',
  };

  Object.entries(flagMappings).forEach(([short, long]) => {
    if (args[short] !== undefined && args[long] === undefined) {
      normalized[long] = args[short];
    }
  });

  return normalized;
};

/**
 * Prints error messages in a user-friendly format
 * @param {Array<string>} errors - Array of error messages
 */
export const printErrors = errors => {
  console.error('\n❌ Configuration Errors:');
  errors.forEach(error => {
    console.error(`   • ${error}`);
  });
  console.error('\nUse --help for usage information.\n');
};

/**
 * Prints verbose information
 * @param {string} message - Message to print
 * @param {boolean} verbose - Whether verbose mode is enabled
 */
export const printVerbose = (message, verbose = false) => {
  if (verbose) {
    console.log(`🔍 ${message}`);
  }
};

/**
 * Prints success message
 * @param {string} message - Success message
 */
export const printSuccess = message => {
  console.log(`✅ ${message}`);
};

/**
 * Prints warning message
 * @param {string} message - Warning message
 */
export const printWarning = message => {
  console.warn(`⚠️  ${message}`);
};

/**
 * Prints info message
 * @param {string} message - Info message
 */
export const printInfo = message => {
  console.log(`ℹ️  ${message}`);
};

/**
 * Creates a progress indicator for bulk operations
 * @param {number} total - Total number of items
 * @returns {Object} - Progress indicator object
 */
export const createProgressIndicator = total => {
  let current = 0;

  return {
    update: (increment = 1) => {
      current += increment;
      const percentage = Math.round((current / total) * 100);
      const filled = Math.floor(percentage / 2);
      const empty = Math.max(0, 50 - filled);
      const progressBar = '█'.repeat(filled) + '░'.repeat(empty);

      process.stdout.write(`\r📧 Progress: [${progressBar}] ${percentage}% (${current}/${total})`);

      if (current >= total) {
        process.stdout.write('\n');
      }
    },
    complete: () => {
      current = total;
      process.stdout.write(`\r📧 Progress: [${'█'.repeat(50)}] 100% (${total}/${total})\n`);
    },
  };
};

/**
 * Formats file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = bytes => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};
