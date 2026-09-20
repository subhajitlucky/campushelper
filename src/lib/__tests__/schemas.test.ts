import { describe, expect, it } from 'vitest';
import { claimsQuerySchema, createClaimSchema } from '@/lib/schemas/claim';
import { updateClaimStatusSchema } from '@/lib/schemas/claim-update';

describe('createClaimSchema', () => {
  it('accepts a minimal valid claim', () => {
    const result = createClaimSchema.safeParse({ claimType: 'FOUND_IT', itemId: 'item-1' });
    expect(result.success).toBe(true);
  });

  it('rejects unknown claim types and empty item IDs', () => {
    expect(createClaimSchema.safeParse({ claimType: 'STEAL_IT', itemId: 'item-1' }).success).toBe(false);
    expect(createClaimSchema.safeParse({ claimType: 'OWN_IT', itemId: '' }).success).toBe(false);
  });

  it('caps the message length at 500 characters', () => {
    const longMessage = 'a'.repeat(501);
    const result = createClaimSchema.safeParse({ claimType: 'OWN_IT', itemId: 'item-1', message: longMessage });
    expect(result.success).toBe(false);
  });
});

describe('claimsQuerySchema', () => {
  it('requires at least one filter', () => {
    expect(claimsQuerySchema.safeParse({}).success).toBe(false);
    expect(claimsQuerySchema.safeParse({ itemId: 'item-1' }).success).toBe(true);
    expect(claimsQuerySchema.safeParse({ userId: 'user-1' }).success).toBe(true);
  });
});

describe('updateClaimStatusSchema', () => {
  it('only allows approval or rejection', () => {
    expect(updateClaimStatusSchema.safeParse({ status: 'APPROVED' }).success).toBe(true);
    expect(updateClaimStatusSchema.safeParse({ status: 'REJECTED' }).success).toBe(true);
    expect(updateClaimStatusSchema.safeParse({ status: 'PENDING' }).success).toBe(false);
  });
});
