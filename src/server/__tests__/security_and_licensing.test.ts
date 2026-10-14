import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyAdminPin,
  verifyAdminSession,
  generateServerLicenseCode,
  redeemServerLicense,
  getAuthoritativeQuota,
  consumeAuthoritativeQuota,
  createSignedUserToken,
  verifySignedUserToken,
  FREE_SEARCH_LIMIT,
} from '../licenseStore';

describe('Task E & H: Security, Licensing, and Quota Enforcement', () => {
  test('5. Unauthenticated users cannot access protected administrative operations without valid session', () => {
    assert.strictEqual(verifyAdminSession(undefined), false);
    assert.strictEqual(verifyAdminSession(''), false);
    assert.strictEqual(verifyAdminSession('Bearer invalid_token_xyz'), false);
  });

  test('6. Non-administrators cannot gain administrator privileges with invalid or backdoor PINs', () => {
    // Backdoors like '3636' or '213563710494' must be strictly rejected
    const res1 = verifyAdminPin('3636', '127.0.0.1');
    assert.strictEqual(res1.success, false);

    const res2 = verifyAdminPin('213563710494', '127.0.0.1');
    assert.strictEqual(res2.success, false);

    const res3 = verifyAdminPin('wrong-pin', '127.0.0.1');
    assert.strictEqual(res3.success, false);
  });

  test('Valid admin PIN issues a verifiable session token', () => {
    const validPin = process.env.ADMIN_PIN || 'chahin36';
    const res = verifyAdminPin(validPin, '127.0.0.1');
    assert.strictEqual(res.success, true);
    assert.ok(res.token);
    assert.strictEqual(verifyAdminSession(`Bearer ${res.token}`), true);
  });

  test('7. Usage limits cannot be bypassed: server tracks authoritative quotas', () => {
    const testEmail = `test_quota_${Date.now()}@example.com`;
    
    // Initially 0 used
    const initialQuota = getAuthoritativeQuota(testEmail);
    assert.strictEqual(initialQuota.used, 0);
    assert.strictEqual(initialQuota.total, FREE_SEARCH_LIMIT);
    assert.strictEqual(initialQuota.isExhausted, false);

    // Consume up to limit
    for (let i = 0; i < FREE_SEARCH_LIMIT; i++) {
      const consumption = consumeAuthoritativeQuota(testEmail);
      assert.strictEqual(consumption.success, true);
      assert.strictEqual(consumption.used, i + 1);
    }

    // Next consumption exceeds quota
    const exhaustedCheck = getAuthoritativeQuota(testEmail);
    assert.strictEqual(exhaustedCheck.used, FREE_SEARCH_LIMIT);
    assert.strictEqual(exhaustedCheck.isExhausted, true);

    const overLimit = consumeAuthoritativeQuota(testEmail);
    assert.strictEqual(overLimit.success, false);
  });

  test('Server license codes are single-use and cannot be redeemed twice', () => {
    const newCode = generateServerLicenseCode('pro', '1_month', 'Unit Test');
    assert.ok(newCode.code.startsWith('OMNI-PRO-'));
    assert.strictEqual(newCode.isUsed, false);

    const testEmail = `user_${Date.now()}@test.com`;
    
    // First redemption succeeds
    const redeem1 = redeemServerLicense(newCode.code, testEmail);
    assert.strictEqual(redeem1.success, true);
    assert.ok(redeem1.token);
    assert.strictEqual(redeem1.userPlan?.tier, 'pro');

    // Second redemption must fail
    const redeem2 = redeemServerLicense(newCode.code, 'attacker@test.com');
    assert.strictEqual(redeem2.success, false);
    assert.match(redeem2.message, /already redeemed/i);
  });

  test('Signed user tokens are tamper-proof and verifiable', () => {
    const token = createSignedUserToken({
      email: 'verified@user.com',
      tier: 'pro',
      expiresAt: Date.now() + 100000,
    });

    const verified = verifySignedUserToken(token);
    assert.strictEqual(verified.valid, true);
    assert.strictEqual(verified.user?.tier, 'pro');

    // Tampered token fails verification
    const tampered = token.slice(0, -5) + 'AAAAA';
    assert.strictEqual(verifySignedUserToken(tampered).valid, false);
  });
});
