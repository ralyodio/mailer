# Mailgun Opt-in Confirmation CLI

A Node.js CLI tool that leverages Mailgun to automate sending pre-import opt-in confirmation emails to subscribers. Perfect for verifying user consent before importing subscriber lists into email platforms like Substack.

## Features

- 📧 **Automated Email Sending**: Send personalized opt-in confirmation emails via Mailgun
- 📊 **CSV Processing**: Handle subscriber lists with email validation
- 🎨 **Template Customization**: Support for both text and HTML email templates with placeholders
- 🔗 **Unique Confirmation Links**: Generate secure, unique confirmation tokens for each subscriber
- 📈 **Comprehensive Logging**: Track email delivery status with detailed CSV reports
- ⚡ **Rate Limiting**: Respect Mailgun's API limits with configurable sending rates
- 🔍 **Dry Run Mode**: Preview emails before sending
- 🛡️ **GDPR/CAN-SPAM Compliant**: Built-in compliance features

## Installation

### Prerequisites

- Node.js 20 or newer
- A Mailgun account with API access
- pnpm (recommended) or npm

### Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Using npm
npm install
```

### Global Installation

```bash
# Install globally to use from anywhere
pnpm install -g

# Or link for development
pnpm link
```

## Quick Start

### 1. Configure Environment Variables

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your Mailgun credentials:

```env
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=your_mailgun_domain_here
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Your Company Name
CONFIRMATION_BASE_URL=https://yourdomain.com/confirm
RATE_LIMIT=10
```

### 2. Prepare Your Data

Create a CSV file with subscriber data. Required column: `email`. Optional: `first_name`, `last_name`.

Example (`subscribers.csv`):
```csv
email,first_name,last_name
john.doe@example.com,John,Doe
jane.smith@example.com,Jane,Smith
newsletter@company.com,,
```

### 3. Create Email Template

Create a JSON template file with your email content:

```json
{
  "subject": "Please confirm your subscription to {company_name}",
  "text": "Hello {first_name},\n\nPlease confirm your subscription by clicking: {confirmation_url}",
  "html": "<p>Hello {first_name},</p><p><a href=\"{confirmation_url}\">Confirm Subscription</a></p>",
  "confirmationUrl": "https://yourdomain.com/confirm?token={confirmation_token}&email={email}"
}
```

### 4. Send Emails

```bash
# Basic usage
mailer send --csv=subscribers.csv --template=template.json --output=results.csv

# With custom rate limiting
mailer send --csv=list.csv --template=confirm.json --output=log.csv --rate-limit=5

# Dry run to preview emails
mailer send --csv=test.csv --template=template.json --output=preview.csv --dry-run
```

## Usage

### Command Line Options

```
Usage:
  mailer <command> [options]

Commands:
  send        Send opt-in confirmation emails to subscribers
  help        Show help information
  version     Show version information

Send Command:
  mailer send --csv=<file> --template=<file> --output=<file> [options]

Required Arguments:
  --csv, -c <file>        Path to CSV file containing subscriber data
  --template, -t <file>   Path to JSON template file for email content
  --output, -o <file>     Path to output CSV file for logging results

Options:
  --rate-limit <number>   Emails per second (default: 10)
  --dry-run              Preview emails without sending
  --verbose, -v          Enable verbose logging
  --help, -h             Show help message

Global Options:
  --help, -h             Show help message
  --version              Show version information
```

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `MAILGUN_API_KEY` | Your Mailgun API key | Yes | - |
| `MAILGUN_DOMAIN` | Your Mailgun domain | Yes | - |
| `FROM_EMAIL` | From email address | Yes | - |
| `FROM_NAME` | From name | No | "Mailer" |
| `CONFIRMATION_BASE_URL` | Base URL for confirmation links | Yes | - |
| `RATE_LIMIT` | Default rate limit (emails/second) | No | 10 |

## Template System

### Available Placeholders

Templates support the following placeholders:

- `{email}` - Subscriber's email address
- `{first_name}` - Subscriber's first name
- `{last_name}` - Subscriber's last name
- `{confirmation_token}` - Unique confirmation token
- `{confirmation_url}` - Complete confirmation URL

### Template Structure

```json
{
  "subject": "Email subject with {placeholders}",
  "text": "Plain text version of the email",
  "html": "HTML version of the email (optional)",
  "confirmationUrl": "Base URL with {confirmation_token} and {email} parameters"
}
```

### Example Templates

#### Simple Text Template
```json
{
  "subject": "Confirm your subscription",
  "text": "Hello {first_name},\n\nClick here to confirm: {confirmation_url}",
  "confirmationUrl": "https://example.com/confirm?token={confirmation_token}&email={email}"
}
```

#### Rich HTML Template
```json
{
  "subject": "Welcome to {company_name}!",
  "text": "Hello {first_name},\n\nWelcome! Please confirm your email: {confirmation_url}",
  "html": "<!DOCTYPE html><html><body><h1>Welcome {first_name}!</h1><p><a href=\"{confirmation_url}\" style=\"background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;\">Confirm Email</a></p></body></html>",
  "confirmationUrl": "https://example.com/confirm?token={confirmation_token}&email={email}&source=newsletter"
}
```

## CSV Format

### Input CSV

Your subscriber CSV must include an `email` column. Additional columns are optional:

```csv
email,first_name,last_name,company
john@example.com,John,Doe,Acme Corp
jane@example.com,Jane,Smith,
newsletter@company.com,,,Company Inc
```

### Output CSV

The tool generates a detailed log CSV with the following columns:

- `timestamp` - When the email was processed
- `email` - Recipient email address
- `status` - "success" or "failed"
- `message_id` - Mailgun message ID (for successful sends)
- `error` - Error message (for failed sends)

## Error Handling

The tool includes comprehensive error handling for:

- Invalid CSV format or missing email column
- Invalid email addresses
- Mailgun API errors
- Network connectivity issues
- File system errors
- Template validation errors

## Rate Limiting

To respect Mailgun's API limits and avoid overwhelming recipients:

- Default rate: 10 emails per second
- Configurable via `--rate-limit` option or `RATE_LIMIT` environment variable
- Automatic delays between email sends

## Security Features

- **Unique Tokens**: Each subscriber gets a cryptographically secure confirmation token
- **Email Validation**: Comprehensive email format validation
- **URL Encoding**: Automatic encoding of email addresses in URLs
- **No Data Storage**: No subscriber data is stored beyond log files

## Development

### Project Structure

```
├── src/
│   ├── index.js              # CLI entry point
│   ├── csv-parser.js         # CSV handling and validation
│   ├── mailgun-client.js     # Mailgun integration
│   ├── template-processor.js # Email template processing
│   ├── confirmation-links.js # Token generation and validation
│   ├── logger.js             # Logging and reporting
│   └── cli.js                # Command-line interface
├── test/                     # Test files
├── examples/                 # Example files
│   ├── subscribers.csv       # Sample CSV
│   └── template.json         # Sample template
├── package.json
├── .env.example
└── README.md
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

# Run tests in watch mode
pnpm run test:watch
```

### Linting and Formatting

```bash
# Check code style
pnpm run lint

# Fix code style issues
pnpm run lint:fix

# Format code
pnpm run format
```

## Examples

### Basic Newsletter Confirmation

```bash
# Send confirmation emails to newsletter subscribers
mailgun-confirm \
  --csv=newsletter-subscribers.csv \
  --template=newsletter-template.json \
  --output=newsletter-results.csv
```

### High-Volume with Rate Limiting

```bash
# Send to large list with slower rate
mailgun-confirm \
  --csv=large-list.csv \
  --template=template.json \
  --output=results.csv \
  --rate-limit=5 \
  --verbose
```

### Testing with Dry Run

```bash
# Preview emails without sending
mailgun-confirm \
  --csv=test-list.csv \
  --template=template.json \
  --output=preview.csv \
  --dry-run
```

## Troubleshooting

### Common Issues

1. **"Mailgun API key is required"**
   - Ensure `MAILGUN_API_KEY` is set in your environment or `.env` file

2. **"Invalid email address found"**
   - Check your CSV for malformed email addresses
   - Ensure the `email` column exists and contains valid emails

3. **"Template file not found"**
   - Verify the template file path is correct
   - Ensure the file has `.json` extension

4. **Rate limiting errors**
   - Reduce the `--rate-limit` value
   - Check your Mailgun account limits

### Debug Mode

For detailed error information, set the environment variable:

```bash
NODE_ENV=development mailgun-confirm [options]
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run tests: `pnpm test`
5. Commit your changes: `git commit -am 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/username/mailgun-optin-cli)
- 🐛 [Issue Tracker](https://github.com/username/mailgun-optin-cli/issues)
- 💬 [Discussions](https://github.com/username/mailgun-optin-cli/discussions)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.