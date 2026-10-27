import { describe, expect, it } from 'vitest';

import { auditIpFromRequest } from '@/lib/audit';

function requestWith(headers: Record<string, string>): Request {
  return new Request('http://localhost/admin', { headers });
}

describe('auditIpFromRequest', () => {
  it('takes the first address from x-forwarded-for', () => {
    expect(
      auditIpFromRequest(requestWith({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))
    ).toBe('203.0.113.7');
  });

  it('accepts an IPv6 literal and x-real-ip', () => {
    expect(auditIpFromRequest(requestWith({ 'x-real-ip': '2001:db8::1' }))).toBe(
      '2001:db8::1'
    );
  });

  it('rejects a header that is not an IP address', () => {
    expect(
      auditIpFromRequest(requestWith({ 'x-forwarded-for': 'not-an-ip, 10.0.0.1' }))
    ).toBeNull();
    expect(
      auditIpFromRequest(requestWith({ 'x-forwarded-for': '<script>alert(1)</script>' }))
    ).toBeNull();
  });

  it('rejects an over-long value instead of storing it', () => {
    expect(
      auditIpFromRequest(requestWith({ 'x-forwarded-for': '1'.repeat(200) }))
    ).toBeNull();
  });

  it('returns null when no address header is present', () => {
    expect(auditIpFromRequest(requestWith({}))).toBeNull();
  });
});
