import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateConvexTarget } from '../lib/convex-target.mjs';

const target = {
  team: 'madearga',
  project: 'ruang',
  developmentDeployment: 'dev:ruang-test-123',
};
const backend = `CONVEX_DEPLOYMENT=dev:ruang-test-123 # team: madearga, project: ruang
CONVEX_URL=https://ruang-test-123.convex.cloud
CONVEX_SITE_URL=https://ruang-test-123.convex.site
`;
const frontend = `NEXT_PUBLIC_CONVEX_URL=https://ruang-test-123.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://ruang-test-123.convex.site
`;
const check = (overrides = {}) =>
  validateConvexTarget({
    target,
    backend,
    frontend,
    environment: {},
    ...overrides,
  });

test('accepts the explicitly pinned Ruang development deployment', () => {
  assert.equal(check().deployment, target.developmentDeployment);
});

test('rejects a development deployment from another project', () => {
  assert.throws(
    () =>
      check({
        backend: backend.replace(
          'dev:ruang-test-123',
          'dev:other-legacy-app-123'
        ),
      }),
    /deployment/i
  );
});

test('requires a configured deployment rather than auto-selecting a project', () => {
  assert.throws(
    () => check({ target: { ...target, developmentDeployment: null } }),
    /pin|configured/i
  );
  assert.throws(() => check({ backend: '' }), /CONVEX_DEPLOYMENT/);
});

test('rejects a production deployment', () => {
  assert.throws(
    () =>
      check({
        target: { ...target, developmentDeployment: 'prod:ruang-test-123' },
      }),
    /development/i
  );
});

test('rejects a backend URL for another deployment', () => {
  assert.throws(
    () =>
      check({
        backend: backend.replace(
          'https://ruang-test-123.convex.cloud',
          'https://other-app-123.convex.cloud'
        ),
      }),
    /CONVEX_URL/
  );
});

test('rejects a frontend that still points to the old backend', () => {
  assert.throws(
    () =>
      check({
        frontend: frontend.replace(
          'https://ruang-test-123.convex.site',
          'https://other-legacy-app-123.convex.site'
        ),
      }),
    /NEXT_PUBLIC_CONVEX_SITE_URL/
  );
});

test('accepts regional deployment URLs', () => {
  const regional = check({
    backend: backend
      .replace('https://ruang-test-123.convex.cloud', 'https://ruang-test-123.ap-southeast-2.convex.cloud')
      .replace('https://ruang-test-123.convex.site', 'https://ruang-test-123.ap-southeast-2.convex.site'),
    frontend: frontend
      .replace('https://ruang-test-123.convex.cloud', 'https://ruang-test-123.ap-southeast-2.convex.cloud')
      .replace('https://ruang-test-123.convex.site', 'https://ruang-test-123.ap-southeast-2.convex.site'),
  });
  assert.equal(regional.cloudUrl, 'https://ruang-test-123.ap-southeast-2.convex.cloud');
});

test('rejects a URL that names another deployment or service', () => {
  assert.throws(() => check({ backend: backend.replace('ruang-test-123.convex.cloud', 'other-app-123.ap-southeast-2.convex.cloud') }), /CONVEX_URL/);
  assert.throws(() => check({ frontend: frontend.replace('ruang-test-123.convex.site', 'ruang-test-123.convex.cloud') }), /NEXT_PUBLIC_CONVEX_SITE_URL/);
});

test('accepts a deploy key that targets the pinned development deployment', () => {
  const key = 'dev:ruang-test-123|cGF5bG9hZA==';
  assert.doesNotThrow(() => check({ environment: { CONVEX_DEPLOY_KEY: key } }));
  assert.doesNotThrow(() => check({ backend: backend + `CONVEX_DEPLOY_KEY=${key}\n` }));
});

test('refuses deploy keys that target another deployment or type', () => {
  for (const key of [
    'dev:prestigious-goshawk-967|cGF5bG9hZA==',
    'prod:ruang-test-123|cGF5bG9hZA==',
    'preview:ruang-test-123|cGF5bG9hZA==',
    'dev:ruang-test-456|cGF5bG9hZA==',
    'not-a-deployment-key',
  ]) {
    assert.throws(() => check({ environment: { CONVEX_DEPLOY_KEY: key } }), /CONVEX_DEPLOY_KEY/);
    assert.throws(() => check({ backend: backend + `CONVEX_DEPLOYMENT_TOKEN=${key}\n` }), /CONVEX_DEPLOYMENT_TOKEN/);
  }
});

test('rejects ambient alternate self-hosted targets', () => {
  for (const key of [
    'CONVEX_SELF_HOSTED_URL',
    'CONVEX_SELF_HOSTED_ADMIN_KEY',
  ]) {
    assert.throws(
      () =>
        check({ environment: { [key]: 'private-value-must-not-be-shown' } }),
      (error) => {
        assert.match(error.message, new RegExp(key));
        assert.doesNotMatch(error.message, /private-value-must-not-be-shown/);
        return true;
      }
    );
  }
});

test('rejects target overrides hidden in the backend env file', () => {
  assert.throws(
    () =>
      check({
        backend:
          backend + 'CONVEX_DEPLOY_KEY=private-value-must-not-be-shown\n',
      }),
    /CONVEX_DEPLOY_KEY/
  );
});

test('rejects ambient deployment selection when it disagrees without a key', () => {
  assert.throws(
    () => check({ environment: { CONVEX_DEPLOYMENT: 'dev:other-app-123' } }),
    /CONVEX_DEPLOYMENT/
  );
});

test('ignores a stale ambient selection when the matching key authorizes the run', () => {
  assert.doesNotThrow(() =>
    check({
      environment: {
        CONVEX_DEPLOY_KEY: 'dev:ruang-test-123|cGF5bG9hZA==',
        CONVEX_DEPLOYMENT: 'dev:prestigious-goshawk-967',
      },
    })
  );
});

test('rejects duplicate selection keys instead of relying on parser precedence', () => {
  assert.throws(
    () => check({ backend: backend + 'CONVEX_DEPLOYMENT=dev:other-app-123\n' }),
    /duplicate/i
  );
});

test('the actual CLI refuses caller-supplied targeting arguments before invoking Convex', () => {
  // This is a CLI subprocess, not another child of the Node test runner.
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const result = spawnSync(
    process.execPath,
    [
      '--',
      fileURLToPath(new URL('../convex-dev.mjs', import.meta.url)),
      'push',
      '--env-file',
      '/tmp/some-other-project.env',
    ],
    { encoding: 'utf8', env: environment }
  );
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /without target overrides/);
  assert.doesNotMatch(result.stdout, /Verified/);
});

test('accepts quoted values and Windows line endings', () => {
  assert.equal(
    check({
      backend: backend
        .replace(
          'CONVEX_DEPLOYMENT=dev:ruang-test-123',
          'CONVEX_DEPLOYMENT="dev:ruang-test-123"'
        )
        .replaceAll('\n', '\r\n'),
    }).deployment,
    target.developmentDeployment
  );
});
