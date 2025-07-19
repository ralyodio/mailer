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
 * Main CLI application function
 */
async function main() {
  try {
    // Parse command line arguments
    const rawArgs = parseArguments(process.argv);
    const args = normalizeArguments(rawArgs);

    // Handle help and version flags
    if (args.help) {
      console.log(showHelp());
      process.exit(0);
    }

    if (args.version) {
      console.log(showVersion());
      process.exit(0);
    }

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

    console.error('\nFor help, run: mailgun-confirm --help');
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

export { main };
