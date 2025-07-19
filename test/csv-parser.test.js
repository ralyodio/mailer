import { expect } from 'chai';
import { promises as fs } from 'fs';
import { join } from 'path';
import { parseCSV, validateEmail, validateCSVStructure } from '../src/csv-parser.js';

describe('CSV Parser Module', () => {
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

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'firstname.lastname@company.com',
        'email@123.123.123.123', // IP address
        'user@domain-name.com',
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).to.be.true;
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..name@example.com',
        'user@.com',
        'user@domain.',
        '',
        null,
        undefined,
        'user name@example.com', // space
        'user@domain..com', // double dot
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).to.be.false;
      });
    });
  });

  describe('validateCSVStructure', () => {
    it('should validate CSV with required email column', () => {
      const validData = [
        { email: 'test@example.com' },
        { email: 'user@domain.com', first_name: 'John' },
        { email: 'another@test.com', first_name: 'Jane', last_name: 'Doe' },
      ];

      expect(() => validateCSVStructure(validData)).to.not.throw();
    });

    it('should throw error for CSV without email column', () => {
      const invalidData = [
        { name: 'John', surname: 'Doe' },
        { first_name: 'Jane', last_name: 'Smith' },
      ];

      expect(() => validateCSVStructure(invalidData)).to.throw(
        'CSV must contain an "email" column',
      );
    });

    it('should throw error for empty CSV data', () => {
      expect(() => validateCSVStructure([])).to.throw('CSV file is empty');
    });

    it('should throw error for invalid email addresses in data', () => {
      const invalidData = [
        { email: 'valid@example.com' },
        { email: 'invalid-email' },
        { email: 'another@valid.com' },
      ];

      expect(() => validateCSVStructure(invalidData)).to.throw(
        'Invalid email address found: invalid-email',
      );
    });
  });

  describe('parseCSV', () => {
    beforeEach(async () => {
      // Create test CSV files for each test
      const validCSV = `email,first_name,last_name
test@example.com,John,Doe
user@domain.com,Jane,Smith
another@test.com,Bob,Johnson`;

      const invalidEmailCSV = `email,first_name,last_name
test@example.com,John,Doe
invalid-email,Jane,Smith
another@test.com,Bob,Johnson`;

      const noEmailColumnCSV = `name,surname
John,Doe
Jane,Smith`;

      const emptyCSV = 'email,first_name,last_name';

      await fs.writeFile(join(testDataDir, 'valid.csv'), validCSV);
      await fs.writeFile(join(testDataDir, 'invalid-email.csv'), invalidEmailCSV);
      await fs.writeFile(join(testDataDir, 'no-email-column.csv'), noEmailColumnCSV);
      await fs.writeFile(join(testDataDir, 'empty.csv'), emptyCSV);
    });

    it('should parse valid CSV file successfully', async () => {
      const filePath = join(testDataDir, 'valid.csv');
      const result = await parseCSV(filePath);

      expect(result).to.be.an('array');
      expect(result).to.have.length(3);
      expect(result[0]).to.deep.equal({
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      });
      expect(result[1]).to.deep.equal({
        email: 'user@domain.com',
        first_name: 'Jane',
        last_name: 'Smith',
      });
    });

    it('should handle CSV with only email column', async () => {
      const emailOnlyCSV = `email
test@example.com
user@domain.com`;

      await fs.writeFile(join(testDataDir, 'email-only.csv'), emailOnlyCSV);
      const filePath = join(testDataDir, 'email-only.csv');
      const result = await parseCSV(filePath);

      expect(result).to.have.length(2);
      expect(result[0]).to.deep.equal({ email: 'test@example.com' });
    });

    it('should throw error for non-existent file', async () => {
      const filePath = join(testDataDir, 'non-existent.csv');

      try {
        await parseCSV(filePath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('ENOENT');
      }
    });

    it('should throw error for CSV with invalid email addresses', async () => {
      const filePath = join(testDataDir, 'invalid-email.csv');

      try {
        await parseCSV(filePath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Invalid email address found: invalid-email');
      }
    });

    it('should throw error for CSV without email column', async () => {
      const filePath = join(testDataDir, 'no-email-column.csv');

      try {
        await parseCSV(filePath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('CSV must contain an "email" column');
      }
    });

    it('should throw error for empty CSV file', async () => {
      const filePath = join(testDataDir, 'empty.csv');

      try {
        await parseCSV(filePath);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('CSV file is empty');
      }
    });

    it('should handle CSV with extra whitespace in emails', async () => {
      const whitespaceCSV = `email,first_name
  test@example.com  ,John
 user@domain.com,Jane `;

      await fs.writeFile(join(testDataDir, 'whitespace.csv'), whitespaceCSV);
      const filePath = join(testDataDir, 'whitespace.csv');
      const result = await parseCSV(filePath);

      expect(result[0].email).to.equal('test@example.com');
      expect(result[1].email).to.equal('user@domain.com');
    });
  });
});
