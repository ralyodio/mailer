# Mailgun Opt-in Confirmation CLI Tool - Development Plan

## Project Overview
A Node.js CLI tool that leverages Mailgun to automate sending pre-import opt-in confirmation emails to subscribers from CSV files.

## Development Tasks

### 1. Project Setup
- [x] Create project structure and TODO.md file
- [ ] Initialize package.json with dependencies
- [ ] Set up ESLint and Prettier configuration
- [ ] Create environment configuration (.env.example)

### 2. CSV Processing Module
- [ ] Write tests for CSV parsing and validation
- [ ] Implement CSV parsing and email validation
- [ ] Handle CSV format validation (email, first_name, last_name columns)
- [ ] Email address validation using built-in Node.js capabilities

### 3. Mailgun Integration Module
- [ ] Write tests for Mailgun integration
- [ ] Implement Mailgun email sending functionality
- [ ] Add rate limiting per Mailgun best practices
- [ ] Handle Mailgun API errors and retries

### 4. Email Template Processing Module
- [ ] Write tests for template processing
- [ ] Implement email template processing with placeholders
- [ ] Support for {first_name}, {last_name}, {email} placeholders
- [ ] Support both plain text and HTML formatting

### 5. Confirmation Link Generation Module
- [ ] Write tests for confirmation link generation
- [ ] Implement unique confirmation link generation using UUID
- [ ] Generate URL parameters for tracking
- [ ] Handle confirmation page URL configuration

### 6. Logging and Reporting Module
- [ ] Write tests for logging functionality
- [ ] Implement CSV logging and reporting
- [ ] Track email send status (sent, bounced, errors)
- [ ] Generate summary statistics

### 7. CLI Interface Module
- [ ] Write tests for CLI interface
- [ ] Implement CLI argument parsing and main logic
- [ ] Handle command-line arguments (--csv, --template, --output)
- [ ] Provide clear error messages and help text

### 8. Integration and Testing
- [ ] Create example template.json and CSV files
- [ ] Add comprehensive error handling
- [ ] Test end-to-end functionality
- [ ] Create README with usage instructions

## Technical Stack
- **Runtime**: Node.js 20+ with ESM modules
- **Testing**: Mocha + Chai
- **Linting**: ESLint + Prettier
- **Dependencies**: 
  - `mailgun.js` (Mailgun SDK)
  - `csv-parser` (CSV parsing)
  - `uuid` (Unique ID generation)
  - `dotenv` (Environment variables)

## File Structure
```
/
├── src/
│   ├── index.js              # CLI entry point
│   ├── csv-parser.js         # CSV handling module
│   ├── mailgun-client.js     # Mailgun integration
│   ├── template-processor.js # Email template processing
│   ├── confirmation-links.js # Unique link generation
│   └── logger.js             # Logging and reporting
├── test/
│   ├── csv-parser.test.js
│   ├── mailgun-client.test.js
│   ├── template-processor.test.js
│   ├── confirmation-links.test.js
│   ├── logger.test.js
│   └── cli.test.js
├── examples/
│   ├── subscribers.csv
│   └── template.json
├── package.json
├── .env.example
├── .eslintrc.js
├── .prettierrc
└── README.md
```

## Success Criteria
- [ ] Reliable delivery of confirmation emails via Mailgun
- [ ] User-friendly CLI interface with clear error messages
- [ ] Comprehensive logging and reporting
- [ ] GDPR/CAN-SPAM compliant email templates
- [ ] High test coverage (>90%)
- [ ] Clean, maintainable code following ESM standards