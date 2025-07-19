import { expect } from 'chai';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  loadTemplate,
  validateTemplate,
  processTemplate,
  processTemplateForSubscriber,
  getTemplateVariables,
} from '../src/template-processor.js';

describe('Template Processor Module', () => {
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

  describe('validateTemplate', () => {
    it('should validate complete template', () => {
      const validTemplate = {
        subject: 'Welcome {first_name}!',
        text: 'Hello {first_name} {last_name}',
        html: '<p>Hello {first_name} {last_name}</p>',
        confirmationUrl: 'https://example.com/confirm?token={confirmation_token}',
      };

      expect(() => validateTemplate(validTemplate)).to.not.throw();
    });

    it('should throw error for missing subject', () => {
      const invalidTemplate = {
        text: 'Hello {first_name}',
        html: '<p>Hello {first_name}</p>',
      };

      expect(() => validateTemplate(invalidTemplate)).to.throw('Template must include a subject');
    });

    it('should throw error for missing content', () => {
      const invalidTemplate = {
        subject: 'Welcome!',
      };

      expect(() => validateTemplate(invalidTemplate)).to.throw(
        'Template must include either text or html content',
      );
    });

    it('should throw error for missing confirmation URL', () => {
      const invalidTemplate = {
        subject: 'Welcome!',
        text: 'Hello there',
      };

      expect(() => validateTemplate(invalidTemplate)).to.throw(
        'Template must include a confirmationUrl',
      );
    });

    it('should accept template with only text content', () => {
      const validTemplate = {
        subject: 'Welcome!',
        text: 'Hello {first_name}',
        confirmationUrl: 'https://example.com/confirm?token={confirmation_token}',
      };

      expect(() => validateTemplate(validTemplate)).to.not.throw();
    });

    it('should accept template with only html content', () => {
      const validTemplate = {
        subject: 'Welcome!',
        html: '<p>Hello {first_name}</p>',
        confirmationUrl: 'https://example.com/confirm?token={confirmation_token}',
      };

      expect(() => validateTemplate(validTemplate)).to.not.throw();
    });
  });

  describe('processTemplate', () => {
    it('should replace single placeholder', () => {
      const template = 'Hello {first_name}!';
      const data = { first_name: 'John' };
      const result = processTemplate(template, data);

      expect(result).to.equal('Hello John!');
    });

    it('should replace multiple placeholders', () => {
      const template = 'Hello {first_name} {last_name}!';
      const data = { first_name: 'John', last_name: 'Doe' };
      const result = processTemplate(template, data);

      expect(result).to.equal('Hello John Doe!');
    });

    it('should handle missing data gracefully', () => {
      const template = 'Hello {first_name} {last_name}!';
      const data = { first_name: 'John' };
      const result = processTemplate(template, data);

      expect(result).to.equal('Hello John !');
    });

    it('should handle empty data object', () => {
      const template = 'Hello {first_name}!';
      const data = {};
      const result = processTemplate(template, data);

      expect(result).to.equal('Hello !');
    });

    it('should handle template without placeholders', () => {
      const template = 'Hello World!';
      const data = { first_name: 'John' };
      const result = processTemplate(template, data);

      expect(result).to.equal('Hello World!');
    });

    it('should handle null or undefined template', () => {
      expect(processTemplate(null, {})).to.be.null;
      expect(processTemplate(undefined, {})).to.be.undefined;
    });

    it('should handle special characters in data', () => {
      const template = 'Hello {name}!';
      const data = { name: 'José María' };
      const result = processTemplate(template, data);

      expect(result).to.equal('Hello José María!');
    });

    it('should handle repeated placeholders', () => {
      const template = '{first_name}, welcome {first_name}!';
      const data = { first_name: 'John' };
      const result = processTemplate(template, data);

      expect(result).to.equal('John, welcome John!');
    });
  });

  describe('getTemplateVariables', () => {
    it('should extract variables from template', () => {
      const template = 'Hello {first_name} {last_name}! Your email is {email}.';
      const variables = getTemplateVariables(template);

      expect(variables).to.deep.equal(['first_name', 'last_name', 'email']);
    });

    it('should handle duplicate variables', () => {
      const template = '{first_name}, welcome {first_name}! {last_name}';
      const variables = getTemplateVariables(template);

      expect(variables).to.deep.equal(['first_name', 'last_name']);
    });

    it('should return empty array for template without variables', () => {
      const template = 'Hello World!';
      const variables = getTemplateVariables(template);

      expect(variables).to.deep.equal([]);
    });

    it('should handle null or undefined template', () => {
      expect(getTemplateVariables(null)).to.deep.equal([]);
      expect(getTemplateVariables(undefined)).to.deep.equal([]);
    });
  });

  describe('processTemplateForSubscriber', () => {
    const template = {
      subject: 'Welcome {first_name}!',
      text: 'Hello {first_name} {last_name}, please confirm: {confirmation_url}',
      html: '<p>Hello {first_name} {last_name}</p><a href="{confirmation_url}">Confirm</a>',
      confirmationUrl: 'https://example.com/confirm?token={confirmation_token}&email={email}',
    };

    it('should process complete template for subscriber', () => {
      const subscriber = {
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };
      const confirmationToken = 'abc123';

      const result = processTemplateForSubscriber(template, subscriber, confirmationToken);

      expect(result.subject).to.equal('Welcome John!');
      expect(result.text).to.include('Hello John Doe');
      expect(result.text).to.include(
        'https://example.com/confirm?token=abc123&email=john@example.com',
      );
      expect(result.html).to.include('Hello John Doe');
      expect(result.html).to.include(
        'href="https://example.com/confirm?token=abc123&email=john@example.com"',
      );
    });

    it('should handle subscriber with missing name fields', () => {
      const subscriber = {
        email: 'jane@example.com',
      };
      const confirmationToken = 'xyz789';

      const result = processTemplateForSubscriber(template, subscriber, confirmationToken);

      expect(result.subject).to.equal('Welcome !');
      expect(result.text).to.include('Hello  ');
      expect(result.text).to.include(
        'https://example.com/confirm?token=xyz789&email=jane@example.com',
      );
    });

    it('should handle template with only text content', () => {
      const textOnlyTemplate = {
        subject: 'Welcome {first_name}!',
        text: 'Hello {first_name}',
        confirmationUrl: 'https://example.com/confirm?token={confirmation_token}',
      };

      const subscriber = { email: 'test@example.com', first_name: 'Test' };
      const result = processTemplateForSubscriber(textOnlyTemplate, subscriber, 'token123');

      expect(result.subject).to.equal('Welcome Test!');
      expect(result.text).to.equal('Hello Test');
      expect(result.html).to.be.undefined;
    });

    it('should URL encode email in confirmation URL', () => {
      const subscriber = {
        email: 'user+tag@example.com',
        first_name: 'User',
      };
      const confirmationToken = 'token123';

      const result = processTemplateForSubscriber(template, subscriber, confirmationToken);

      expect(result.text).to.include('email=user%2Btag%40example.com');
    });
  });

  describe('loadTemplate', () => {
    beforeEach(async () => {
      // Create test template files
      const validTemplate = {
        subject: 'Welcome {first_name}!',
        text: 'Hello {first_name} {last_name}',
        html: '<p>Hello {first_name} {last_name}</p>',
        confirmationUrl: 'https://example.com/confirm?token={confirmation_token}',
      };

      const invalidTemplate = {
        subject: 'Welcome!',
        // Missing text/html and confirmationUrl
      };

      await fs.writeFile(
        join(testDataDir, 'valid-template.json'),
        JSON.stringify(validTemplate, null, 2),
      );

      await fs.writeFile(
        join(testDataDir, 'invalid-template.json'),
        JSON.stringify(invalidTemplate, null, 2),
      );

      await fs.writeFile(join(testDataDir, 'malformed.json'), '{ invalid json');
    });

    it('should load valid template file', async () => {
      const filePath = join(testDataDir, 'valid-template.json');
      const template = await loadTemplate(filePath);

      expect(template).to.be.an('object');
      expect(template.subject).to.equal('Welcome {first_name}!');
      expect(template.text).to.equal('Hello {first_name} {last_name}');
      expect(template.confirmationUrl).to.equal(
        'https://example.com/confirm?token={confirmation_token}',
      );
    });

    it('should throw error for non-existent file', async () => {
      const filePath = join(testDataDir, 'non-existent.json');

      try {
        await loadTemplate(filePath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Template file not found');
      }
    });

    it('should throw error for malformed JSON', async () => {
      const filePath = join(testDataDir, 'malformed.json');

      try {
        await loadTemplate(filePath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid JSON in template file');
      }
    });

    it('should throw error for invalid template structure', async () => {
      const filePath = join(testDataDir, 'invalid-template.json');

      try {
        await loadTemplate(filePath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Template must include either text or html content');
      }
    });
  });
});
