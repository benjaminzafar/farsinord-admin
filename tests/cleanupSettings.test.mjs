import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCleanupSettings,
  DEFAULT_CLEANUP_SETTINGS,
} from '../api/_lib/cleanupSettingsValidation.js';

// Set a test service-role env var before loading admin.js so HAS_SERVICE_ROLE matches server config;
// validation (400) and auth (401) assertions return before any Supabase network call is issued.
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'unit-test-service-role-key';

const {
  default: adminHandler,
  createAdminToken,
  verifyAdminToken,
} = await import('../api/admin.js');

function createMockRes() {
  const headers = {};
  const state = {
    statusCode: 200,
    body: null,
    ended: false,
  };
  const res = {
    setHeader(k, v) {
      headers[k] = v;
    },
    status(code) {
      state.statusCode = code;
      return res;
    },
    json(payload) {
      state.body = payload;
      state.ended = true;
      return res;
    },
    end() {
      state.ended = true;
      return res;
    },
  };
  return { res, state, headers };
}

test('validateCleanupSettings accepts valid boundaries including 7, 30, 60, 365+ and Persian numerals', () => {
  for (const days of [7, 30, 60, 90, 180, 365, 730, 3650]) {
    const res = validateCleanupSettings({
      enabled: days !== 60,
      inactivityDays: days,
      warningDays: 7,
      softDeleteRetentionDays: 30,
      freeBoostCooldownDays: 7,
    });
    assert.equal(res.ok, true, `Expected ${days} days to be valid`);
    assert.equal(res.value.inactivityDays, days);
    assert.equal(res.value.enabled, days !== 60);
  }

  const persianRes = validateCleanupSettings({
    enabled: true,
    inactivityDays: '۶۰',
    warningDays: '۱۴',
    softDeleteRetentionDays: '۴۵',
    freeBoostCooldownDays: '۷',
  });
  assert.equal(persianRes.ok, true);
  assert.deepEqual(
    {
      enabled: persianRes.value.enabled,
      inactivityDays: persianRes.value.inactivityDays,
      warningDays: persianRes.value.warningDays,
      softDeleteRetentionDays: persianRes.value.softDeleteRetentionDays,
      freeBoostCooldownDays: persianRes.value.freeBoostCooldownDays,
    },
    {
      enabled: true,
      inactivityDays: 60,
      warningDays: 14,
      softDeleteRetentionDays: 45,
      freeBoostCooldownDays: 7,
    }
  );
  assert.equal(
    persianRes.value.duplicateBlockThresholdSameOwner,
    DEFAULT_CLEANUP_SETTINGS.duplicateBlockThresholdSameOwner
  );
});

test('validateCleanupSettings strictly rejects <7 inactivity, negatives, floats, and non-numeric values', () => {
  const invalidInactivityCases = [6, 1, 0, -1, -30, 30.5, 'abc', '30days', '', null, undefined, true, 3651];
  for (const badVal of invalidInactivityCases) {
    const res = validateCleanupSettings({
      enabled: true,
      inactivityDays: badVal,
      warningDays: 7,
      softDeleteRetentionDays: 30,
    });
    assert.equal(res.ok, false, `Expected inactivityDays=${String(badVal)} to be rejected`);
    assert.ok(res.fieldErrors.inactivityDays, `Expected fieldError for inactivityDays=${String(badVal)}`);
  }

  const invalidWarning = validateCleanupSettings({
    enabled: true,
    inactivityDays: 30,
    warningDays: -3,
    softDeleteRetentionDays: 30,
  });
  assert.equal(invalidWarning.ok, false);
  assert.ok(invalidWarning.fieldErrors.warningDays);

  const invalidRetention = validateCleanupSettings({
    enabled: true,
    inactivityDays: 30,
    warningDays: 7,
    softDeleteRetentionDays: '12.4',
  });
  assert.equal(invalidRetention.ok, false);
  assert.ok(invalidRetention.fieldErrors.softDeleteRetentionDays);

  const invalidEnabled = validateCleanupSettings({
    enabled: 'true',
    inactivityDays: 30,
    warningDays: 7,
    softDeleteRetentionDays: 30,
  });
  assert.equal(invalidEnabled.ok, false);
  assert.ok(invalidEnabled.fieldErrors.enabled);
});

test('Admin API enforces admin authentication on cleanup settings and overview actions', async () => {
  const actionsToProtect = [
    { action: 'cleanup_overview' },
    {
      action: 'save_cleanup_settings',
      settings: { enabled: true, inactivityDays: 45, warningDays: 7, softDeleteRetentionDays: 30 },
    },
    {
      action: 'save_settings',
      key: 'ad_lifecycle_settings',
      value: { enabled: true, inactivityDays: 45, warningDays: 7, softDeleteRetentionDays: 30 },
    },
  ];

  // Missing Authorization header
  for (const body of actionsToProtect) {
    const { res, state } = createMockRes();
    await adminHandler({ method: 'POST', headers: {}, body }, res);
    assert.equal(state.statusCode, 401);
    assert.equal(state.body.ok, false);
  }

  // Tampered payload in token (non-admin role / altered signature check)
  const validToken = createAdminToken('swedpersiska@gmail.com');
  assert.equal(verifyAdminToken(validToken)?.role, 'admin');
  const [, sig] = validToken.split('.');
  const forgedUserPayload = Buffer.from(
    JSON.stringify({ sub: 'user@example.com', role: 'user', exp: Date.now() + 60000 })
  ).toString('base64url');

  const forgedCases = [
    'invalid-token',
    `${forgedUserPayload}.${sig}`,
    `local.${Buffer.from(JSON.stringify({ sub: 'x', role: 'admin', exp: Date.now() + 60000 })).toString('base64')}`,
  ];

  for (const badToken of forgedCases) {
    const { res, state } = createMockRes();
    await adminHandler(
      {
        method: 'POST',
        headers: { authorization: `Bearer ${badToken}` },
        body: actionsToProtect[1],
      },
      res
    );
    assert.equal(state.statusCode, 401);
    assert.equal(state.body.ok, false);
  }
});

test('Admin API with valid admin token rejects invalid cleanup payloads with HTTP 400', async () => {
  const token = createAdminToken('swedpersiska@gmail.com');
  const invalidPayloads = [
    { enabled: true, inactivityDays: 5, warningDays: 7, softDeleteRetentionDays: 30 },
    { enabled: true, inactivityDays: -7, warningDays: 7, softDeleteRetentionDays: 30 },
    { enabled: true, inactivityDays: 'not-a-number', warningDays: 7, softDeleteRetentionDays: 30 },
    { enabled: 'yes', inactivityDays: 30, warningDays: 7, softDeleteRetentionDays: 30 },
    { enabled: true, inactivityDays: 30, warningDays: 0, softDeleteRetentionDays: 30 },
    { enabled: true, inactivityDays: 30, warningDays: 7, softDeleteRetentionDays: 2.5 },
  ];

  for (const badSettings of invalidPayloads) {
    {
      const { res, state } = createMockRes();
      await adminHandler(
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          body: { action: 'save_cleanup_settings', settings: badSettings },
        },
        res
      );
      assert.equal(state.statusCode, 400);
      assert.equal(state.body.ok, false);
      assert.ok(state.body.error);
    }

    {
      const { res, state } = createMockRes();
      await adminHandler(
        {
          method: 'POST',
          headers: { authorization: `Bearer ${token}` },
          body: { action: 'save_settings', key: 'ad_lifecycle_settings', value: badSettings },
        },
        res
      );
      assert.equal(state.statusCode, 400);
      assert.equal(state.body.ok, false);
      assert.ok(state.body.error);
    }
  }
});
