/**
 * PII Obscuring Tests
 *
 * Run with: npm test lib/pii.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  obscureName,
  obscureDate,
  obscureContent,
  obscureLocation,
  shouldObscurePII,
  obscurePatient,
} from './pii';

describe('obscureName', () => {
  it('returns consistent pseudonym for the same name', () => {
    const result1 = obscureName('John Smith');
    const result2 = obscureName('John Smith');
    expect(result1).toBe(result2);
  });

  it('returns different pseudonyms for different names', () => {
    const result1 = obscureName('John Smith');
    const result2 = obscureName('Jane Doe');
    expect(result1).not.toBe(result2);
  });

  it('matches Patient-XXXX format', () => {
    const result = obscureName('Test Patient');
    expect(result).toMatch(/^Patient-[A-Z0-9]{4}$/);
  });

  it('handles empty string', () => {
    const result = obscureName('');
    expect(result).toBe('Patient-XXXX');
  });

  it('handles null', () => {
    const result = obscureName(null);
    expect(result).toBe('Patient-XXXX');
  });

  it('handles undefined', () => {
    const result = obscureName(undefined);
    expect(result).toBe('Patient-XXXX');
  });

  it('is case-insensitive for consistency', () => {
    const result1 = obscureName('John Smith');
    const result2 = obscureName('john smith');
    expect(result1).toBe(result2);
  });
});

describe('obscureDate', () => {
  it('keeps year, hides month and day', () => {
    const result = obscureDate(new Date('1985-03-15'));
    expect(result).toBe('1985-XX-XX');
  });

  it('handles string dates', () => {
    const result = obscureDate('1990-06-20');
    expect(result).toBe('1990-XX-XX');
  });

  it('handles null', () => {
    const result = obscureDate(null);
    expect(result).toBe('XXXX-XX-XX');
  });

  it('handles undefined', () => {
    const result = obscureDate(undefined);
    expect(result).toBe('XXXX-XX-XX');
  });

  it('handles invalid date string', () => {
    const result = obscureDate('not-a-date');
    expect(result).toBe('XXXX-XX-XX');
  });
});

describe('obscureLocation', () => {
  it('redacts location when all fields present', () => {
    const result = obscureLocation('Boston', 'MA', '02101');
    expect(result).toBe('[LOCATION REDACTED]');
  });

  it('redacts location with partial fields', () => {
    const result = obscureLocation('Boston', null, null);
    expect(result).toBe('[LOCATION REDACTED]');
  });

  it('returns Unknown when all fields empty', () => {
    const result = obscureLocation(null, null, null);
    expect(result).toBe('Unknown');
  });
});

describe('obscureContent', () => {
  describe('SSN detection', () => {
    it('redacts SSN in standard format', () => {
      const result = obscureContent('SSN: 123-45-6789');
      expect(result).toContain('[SSN REDACTED]');
      expect(result).not.toContain('123-45-6789');
    });

    it('redacts SSN without prefix', () => {
      const result = obscureContent('Number is 123-45-6789 on file');
      expect(result).toContain('[SSN REDACTED]');
    });
  });

  describe('phone number detection', () => {
    it('redacts phone with parentheses', () => {
      const result = obscureContent('Call (555) 123-4567');
      expect(result).toContain('[PHONE REDACTED]');
      expect(result).not.toContain('555');
    });

    it('redacts phone with dashes', () => {
      const result = obscureContent('Phone: 555-123-4567');
      expect(result).toContain('[PHONE REDACTED]');
    });

    it('redacts phone with dots', () => {
      const result = obscureContent('Contact: 555.123.4567');
      expect(result).toContain('[PHONE REDACTED]');
    });
  });

  describe('email detection', () => {
    it('redacts email addresses', () => {
      const result = obscureContent('Email: patient@hospital.com');
      expect(result).toContain('[EMAIL REDACTED]');
      expect(result).not.toContain('patient@hospital.com');
    });

    it('redacts email with subdomain', () => {
      const result = obscureContent('Contact john.doe@mail.hospital.org');
      expect(result).toContain('[EMAIL REDACTED]');
    });
  });

  describe('name detection', () => {
    it('redacts Mr. prefix names', () => {
      const result = obscureContent('Patient Mr. John Smith arrived');
      expect(result).toContain('[NAME]');
      expect(result).not.toContain('John Smith');
    });

    it('redacts Mrs. prefix names', () => {
      const result = obscureContent('Consulted with Mrs. Jane Doe');
      expect(result).toContain('[NAME]');
    });

    it('redacts Dr. prefix names', () => {
      const result = obscureContent('Referred by Dr. Sarah Johnson');
      expect(result).toContain('[NAME]');
    });
  });

  describe('preserves non-PII', () => {
    it('preserves medical terms', () => {
      const text = 'Patient presents with hypertension and diabetes mellitus type 2.';
      const result = obscureContent(text);
      expect(result).toContain('hypertension');
      expect(result).toContain('diabetes mellitus');
    });

    it('preserves measurements', () => {
      const text = 'Blood pressure 120/80 mmHg, temperature 98.6F';
      const result = obscureContent(text);
      expect(result).toContain('120/80');
      expect(result).toContain('98.6');
    });
  });

  it('handles empty string', () => {
    const result = obscureContent('');
    expect(result).toBe('');
  });

  it('handles null', () => {
    const result = obscureContent(null);
    expect(result).toBe('');
  });
});

describe('shouldObscurePII', () => {
  it('returns explicit flag when provided', () => {
    expect(shouldObscurePII(true)).toBe(true);
    expect(shouldObscurePII(false)).toBe(false);
  });

  it('checks environment when no flag provided', () => {
    const original = process.env.OBSCURE_PII;

    process.env.OBSCURE_PII = 'true';
    expect(shouldObscurePII()).toBe(true);

    process.env.OBSCURE_PII = 'false';
    expect(shouldObscurePII()).toBe(false);

    process.env.OBSCURE_PII = original;
  });
});

describe('obscurePatient', () => {
  it('obscures all PII fields when enabled', () => {
    const patient = {
      id: '123',
      name: 'John Smith',
      birthDate: new Date('1985-03-15'),
      city: 'Boston',
      state: 'MA',
      postalCode: '02101',
      gender: 'male',
    };

    const result = obscurePatient(patient, true);

    expect(result.id).toBe('123'); // ID preserved
    expect(result.name).toMatch(/^Patient-[A-Z0-9]{4}$/);
    expect(result.birthDate).toBe('1985-XX-XX');
    expect(result.city).toBe('[CITY]');
    expect(result.state).toBe('[STATE]');
    expect(result.postalCode).toBe('[ZIP]');
    expect(result.gender).toBe('male'); // Gender preserved
  });

  it('returns original patient when obscure is false', () => {
    const patient = {
      name: 'John Smith',
      birthDate: new Date('1985-03-15'),
    };

    const result = obscurePatient(patient, false);

    expect(result.name).toBe('John Smith');
    expect(result.birthDate).toEqual(new Date('1985-03-15'));
  });
});
