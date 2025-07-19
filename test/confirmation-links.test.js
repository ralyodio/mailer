import { expect } from 'chai';
import { URL } from 'url';
import {
  generateConfirmationToken,
  createConfirmationLink,
  parseConfirmationToken,
  validateConfirmationToken,
  generateTokenForSubscriber,
} from '../src/confirmation-links.js';

describe('Confirmation Links Module', () => {
  describe('generateConfirmationToken', () => {
    it('should generate a unique token', () => {
      const token = generateConfirmationToken();

      expect(token).to.be.a('string');
      expect(token).to.have.length.greaterThan(0);
    });

    it('should generate different tokens on multiple calls', () => {
      const token1 = generateConfirmationToken();
      const token2 = generateConfirmationToken();

      expect(token1).to.not.equal(token2);
    });

    it('should generate tokens without special characters that need URL encoding', () => {
      const token = generateConfirmationToken();

      // Should not contain characters that need URL encoding
      expect(token).to.not.match(/[+/=]/);
    });

    it('should generate tokens of consistent format', () => {
      const tokens = Array.from({ length: 10 }, () => generateConfirmationToken());

      tokens.forEach(token => {
        expect(token).to.be.a('string');
        expect(token.length).to.be.greaterThan(20); // Should be reasonably long
        expect(token).to.match(/^[a-zA-Z0-9-_]+$/); // URL-safe characters only
      });
    });
  });

  describe('generateTokenForSubscriber', () => {
    it('should generate token with subscriber email', () => {
      const subscriber = {
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
      };

      const token = generateTokenForSubscriber(subscriber);

      expect(token).to.be.a('string');
      expect(token).to.have.length.greaterThan(0);
    });

    it('should generate different tokens for different subscribers', () => {
      const subscriber1 = { email: 'user1@example.com' };
      const subscriber2 = { email: 'user2@example.com' };

      const token1 = generateTokenForSubscriber(subscriber1);
      const token2 = generateTokenForSubscriber(subscriber2);

      expect(token1).to.not.equal(token2);
    });

    it('should generate same token for same subscriber when called multiple times', () => {
      const subscriber = { email: 'test@example.com' };

      const token1 = generateTokenForSubscriber(subscriber);
      const token2 = generateTokenForSubscriber(subscriber);

      expect(token1).to.equal(token2);
    });

    it('should handle special characters in email', () => {
      const subscriber = { email: 'user+tag@example.com' };

      const token = generateTokenForSubscriber(subscriber);

      expect(token).to.be.a('string');
      expect(token).to.have.length.greaterThan(0);
    });

    it('should throw error for subscriber without email', () => {
      const subscriber = { first_name: 'John' };

      expect(() => generateTokenForSubscriber(subscriber)).to.throw(
        'Subscriber must have an email address',
      );
    });
  });

  describe('createConfirmationLink', () => {
    const baseUrl = 'https://example.com/confirm';
    const token = 'test-token-123';
    const email = 'test@example.com';

    it('should create basic confirmation link', () => {
      const link = createConfirmationLink(baseUrl, token, email);

      expect(link).to.include(baseUrl);
      expect(link).to.include(`token=${token}`);
      expect(link).to.include(`email=${encodeURIComponent(email)}`);
    });

    it('should handle base URL with existing query parameters', () => {
      const baseUrlWithParams = 'https://example.com/confirm?source=email';
      const link = createConfirmationLink(baseUrlWithParams, token, email);

      expect(link).to.include('source=email');
      expect(link).to.include(`token=${token}`);
      expect(link).to.include(`email=${encodeURIComponent(email)}`);
      expect(link).to.include('&'); // Should use & to separate parameters
    });

    it('should URL encode email addresses with special characters', () => {
      const specialEmail = 'user+tag@example.com';
      const link = createConfirmationLink(baseUrl, token, specialEmail);

      expect(link).to.include(`email=${encodeURIComponent(specialEmail)}`);
      expect(link).to.include('user%2Btag%40example.com');
    });

    it('should handle additional parameters', () => {
      const additionalParams = { source: 'newsletter', campaign: 'welcome' };
      const link = createConfirmationLink(baseUrl, token, email, additionalParams);

      expect(link).to.include('source=newsletter');
      expect(link).to.include('campaign=welcome');
      expect(link).to.include(`token=${token}`);
      expect(link).to.include(`email=${encodeURIComponent(email)}`);
    });

    it('should throw error for invalid base URL', () => {
      expect(() => createConfirmationLink('', token, email)).to.throw('Base URL is required');

      expect(() => createConfirmationLink(null, token, email)).to.throw('Base URL is required');
    });

    it('should throw error for missing token', () => {
      expect(() => createConfirmationLink(baseUrl, '', email)).to.throw('Token is required');

      expect(() => createConfirmationLink(baseUrl, null, email)).to.throw('Token is required');
    });

    it('should throw error for missing email', () => {
      expect(() => createConfirmationLink(baseUrl, token, '')).to.throw('Email is required');

      expect(() => createConfirmationLink(baseUrl, token, null)).to.throw('Email is required');
    });
  });

  describe('parseConfirmationToken', () => {
    it('should parse valid token and return email', () => {
      const subscriber = { email: 'test@example.com' };
      const token = generateTokenForSubscriber(subscriber);

      const parsed = parseConfirmationToken(token);

      expect(parsed).to.be.an('object');
      expect(parsed.email).to.equal(subscriber.email);
      expect(parsed.valid).to.be.true;
    });

    it('should handle invalid token format', () => {
      const invalidToken = 'invalid-token-format';

      const parsed = parseConfirmationToken(invalidToken);

      expect(parsed.valid).to.be.false;
      expect(parsed.error).to.include('Invalid token format');
    });

    it('should handle corrupted token', () => {
      const corruptedToken = 'corrupted.token.data';

      const parsed = parseConfirmationToken(corruptedToken);

      expect(parsed.valid).to.be.false;
      expect(parsed.error).to.be.a('string');
    });

    it('should handle empty or null token', () => {
      expect(parseConfirmationToken('')).to.have.property('valid', false);
      expect(parseConfirmationToken(null)).to.have.property('valid', false);
      expect(parseConfirmationToken(undefined)).to.have.property('valid', false);
    });
  });

  describe('validateConfirmationToken', () => {
    it('should validate token for correct email', () => {
      const subscriber = { email: 'test@example.com' };
      const token = generateTokenForSubscriber(subscriber);

      const isValid = validateConfirmationToken(token, subscriber.email);

      expect(isValid).to.be.true;
    });

    it('should reject token for wrong email', () => {
      const subscriber = { email: 'test@example.com' };
      const token = generateTokenForSubscriber(subscriber);

      const isValid = validateConfirmationToken(token, 'wrong@example.com');

      expect(isValid).to.be.false;
    });

    it('should reject invalid token format', () => {
      const isValid = validateConfirmationToken('invalid-token', 'test@example.com');

      expect(isValid).to.be.false;
    });

    it('should handle case sensitivity in email comparison', () => {
      const subscriber = { email: 'Test@Example.com' };
      const token = generateTokenForSubscriber(subscriber);

      // Should be case insensitive
      const isValid1 = validateConfirmationToken(token, 'test@example.com');
      const isValid2 = validateConfirmationToken(token, 'TEST@EXAMPLE.COM');

      expect(isValid1).to.be.true;
      expect(isValid2).to.be.true;
    });

    it('should handle empty or null inputs', () => {
      expect(validateConfirmationToken('', 'test@example.com')).to.be.false;
      expect(validateConfirmationToken('token', '')).to.be.false;
      expect(validateConfirmationToken(null, 'test@example.com')).to.be.false;
      expect(validateConfirmationToken('token', null)).to.be.false;
    });
  });

  describe('Token Security', () => {
    it('should generate tokens that are not easily guessable', () => {
      const subscriber = { email: 'test@example.com' };
      const tokens = Array.from({ length: 100 }, () => generateTokenForSubscriber(subscriber));

      // All tokens should be the same for the same subscriber
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).to.equal(1);

      // But different subscribers should have different tokens
      const subscriber2 = { email: 'test2@example.com' };
      const token2 = generateTokenForSubscriber(subscriber2);

      expect(tokens[0]).to.not.equal(token2);
    });

    it('should not expose email in plain text within token', () => {
      const subscriber = { email: 'test@example.com' };
      const token = generateTokenForSubscriber(subscriber);

      // Token should not contain the email in plain text
      expect(token).to.not.include('test@example.com');
      expect(token).to.not.include('test');
      expect(token).to.not.include('@example.com');
    });

    it('should generate URL-safe tokens', () => {
      const subscriber = { email: 'test+tag@example.com' };
      const token = generateTokenForSubscriber(subscriber);

      // Token should be URL-safe (no need for additional encoding)
      expect(encodeURIComponent(token)).to.equal(token);
    });
  });

  describe('Integration with URL Generation', () => {
    it('should work end-to-end with link creation and validation', () => {
      const subscriber = { email: 'integration@example.com' };
      const baseUrl = 'https://example.com/confirm';

      // Generate token
      const token = generateTokenForSubscriber(subscriber);

      // Create confirmation link
      const link = createConfirmationLink(baseUrl, token, subscriber.email);

      // Extract token from URL (simulate receiving it back)
      const urlParams = new URL(link).searchParams;
      const extractedToken = urlParams.get('token');
      const extractedEmail = urlParams.get('email');

      // Validate the extracted token
      const isValid = validateConfirmationToken(extractedToken, extractedEmail);

      expect(isValid).to.be.true;
      expect(extractedEmail).to.equal(subscriber.email);
    });
  });
});
