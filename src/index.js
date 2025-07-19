#!/usr/bin/env node

import { parseCSV } from './csv-parser.js';
import { createMailgunClient, sendBulkEmails } from './mailgun-client.js';
import { loadTemplate, processTemplateForSubscriber } from './template-processor.js';
import { generateTokenForSubscriber } from './confirmation-links.js';
import { createLogger, logEmailResult, generateSummaryReport, loadLogFile } from './logger.js';
import {
  parseArguments,
  validateArguments,
  showHelp,
  showVersion,
  loadConfiguration,
  validateConfiguration,
  normalizeArguments,
  printErrors,
  printVerbose,
  printSuccess,
  printInfo,
  createProgressIndicator,
} from './cli.js';

/**
 * Send opt-in confirmation emails command
 */
async function sendCommand(args) {
  try {
    // Validate arguments
    const argValidation = validateArguments(args);
    if (!argValidation.valid) {
      printErrors(argValidation.errors);
      process.exit(1);
    }

    // Load and validate configuration
    const config = loadConfiguration(args);
    const configValidation = validateConfiguration(config);
    if (!configValidation.valid) {
      printErrors(configValidation.errors);
      process.exit(1);
    }

    printVerbose('Configuration loaded successfully', config.verbose);

    // Load and parse CSV file
    printInfo(`Loading CSV file: ${args.csv}`);
    const subscribers = await parseCSV(args.csv);
    printSuccess(`Loaded ${subscribers.length} subscribers from CSV`);

    // Load email template
    printInfo(`Loading email template: ${args.template}`);
    const template = await loadTemplate(args.template);
    printSuccess('Email template loaded successfully');

    // Create Mailgun client
    printVerbose('Creating Mailgun client', config.verbose);
    const mailgunClient = createMailgunClient(config.mailgun);

    // Create logger
    printInfo(`Creating log file: ${args.output}`);
    const logger = await createLogger(args.output);

    // Process emails
    if (config.dryRun) {
      printInfo('🔍 DRY RUN MODE - No emails will be sent');

      // Preview first few emails
      const previewCount = Math.min(3, subscribers.length);
      for (let i = 0; i < previewCount; i++) {
        const subscriber = subscribers[i];
        const token = generateTokenForSubscriber(subscriber);
        const processedTemplate = processTemplateForSubscriber(template, subscriber, token);

        console.log(`\n📧 Preview ${i + 1}:`);
        console.log(`   To: ${subscriber.email}`);
        console.log(`   Subject: ${processedTemplate.subject}`);
        console.log(`   Text: ${processedTemplate.text.substring(0, 100)}...`);
      }

      if (subscribers.length > previewCount) {
        console.log(`\n... and ${subscribers.length - previewCount} more emails`);
      }

      printInfo('Dry run completed. Use without --dry-run to send emails.');
      return;
    }

    // Send emails
    printInfo(`📧 Sending emails to ${subscribers.length} subscribers`);
    printInfo(`Rate limit: ${config.rateLimit} emails per second`);

    const progress = createProgressIndicator(subscribers.length);

    // Process template for each subscriber and prepare email data
    subscribers.map(subscriber => {
      const token = generateTokenForSubscriber(subscriber);
      const processedTemplate = processTemplateForSubscriber(template, subscriber, token);

      return {
        to: subscriber.email,
        subject: processedTemplate.subject,
        text: processedTemplate.text,
        html: processedTemplate.html,
      };
    });

    // Send bulk emails
    const results = await sendBulkEmails(mailgunClient, subscribers, template, {
      rateLimit: config.rateLimit,
    });

    // Log results and update progress
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      await logEmailResult(logger, result);
      progress.update();

      if (config.verbose) {
        const status = result.success ? '✅' : '❌';
        printVerbose(`${status} ${result.email}: ${result.success ? 'sent' : result.error}`, true);
      }
    }

    progress.complete();

    // Generate and display summary
    const logData = await loadLogFile(args.output);
    const summary = generateSummaryReport(logData);

    console.log(`\n${summary}`);

    // Calculate final statistics
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const successRate = Math.round((successful / results.length) * 100);

    if (failed > 0) {
      printInfo(`⚠️  ${failed} emails failed to send. Check ${args.output} for details.`);
    }

    const successMessage = `Email campaign completed! ${successful}/${results.length} emails sent (${successRate}% success rate)`;
    printSuccess(successMessage);
  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);

    if (process.env.NODE_ENV === 'development') {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    console.error('\nFor help, run: mailer send --help');
    process.exit(1);
  }
}

/**
 * Show main help information
 */
function showMainHelp() {
  return `
mailer v1.0.0
CLI tool for sending opt-in confirmation emails via Mailgun

Usage:
  mailer <command> [options]

Commands:
  send        Send opt-in confirmation emails to subscribers
  help        Show help information
  version     Show version information

Options:
  --help, -h  Show help for command
  --version   Show version information

Examples:
  mailer send --csv=subscribers.csv --template=welcome.json --output=results.csv
  mailer help send
  mailer version

For more information on a specific command, run:
  mailer <command> --help
`;
}

/**
 * Show command-specific help
 */
function showCommandHelp(command) {
  switch (command) {
    case 'send':
      return showHelp().replace('mailgun-confirm', 'mailer send');
    default:
      return showMainHelp();
  }
}

/**
 * Main CLI application function
 */
async function main() {
  try {
    const argv = process.argv.slice(2);
    
    // Handle no arguments
    if (argv.length === 0) {
      console.log(showMainHelp());
      process.exit(0);
    }

    const command = argv[0];

    // Handle global flags
    if (command === '--help' || command === '-h') {
      console.log(showMainHelp());
      process.exit(0);
    }

    if (command === '--version') {
      console.log(showVersion());
      process.exit(0);
    }

    // Handle commands
    switch (command) {
      case 'send': {
        // Parse arguments for send command (skip the 'send' command)
        const rawArgs = parseArguments(['node', 'mailer', ...argv.slice(1)]);
        const args = normalizeArguments(rawArgs);

        // Handle command-specific help
        if (args.help) {
          console.log(showCommandHelp('send'));
          process.exit(0);
        }

        await sendCommand(args);
        break;
      }

      case 'help': {
        const helpCommand = argv[1];
        if (helpCommand) {
          console.log(showCommandHelp(helpCommand));
        } else {
          console.log(showMainHelp());
        }
        process.exit(0);
      }

      case 'version': {
        console.log(showVersion());
        process.exit(0);
      }

      default: {
        console.error(`\n❌ Unknown command: ${command}`);
        console.log(showMainHelp());
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);

    if (process.env.NODE_ENV === 'development') {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    console.error('\nFor help, run: mailer --help');
    process.exit(1);
  }
}

/**
 * Handle uncaught exceptions and unhandled rejections
 */
process.on('uncaughtException', error => {
  console.error('\n💥 Uncaught Exception:', error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

/**
 * Handle graceful shutdown
 */
process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT. Gracefully shutting down...');
  console.log('📊 Check your output file for partial results.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Received SIGTERM. Gracefully shutting down...');
  console.log('📊 Check your output file for partial results.');
  process.exit(0);
});

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, sendCommand };
