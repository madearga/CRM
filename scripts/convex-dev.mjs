import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { keyDeployment, validateConvexTarget } from './lib/convex-target.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const mode = process.argv[2];
try {
  if (
    !['check', 'watch', 'push', 'seed'].includes(mode) ||
    process.argv.length !== 3
  ) {
    throw new Error(
      'Use backend:check, backend:dev, backend:push, or seed without target overrides.'
    );
  }
  const selection = validateConvexTarget({
    target: JSON.parse(
      readFileSync(`${root}config/deployment-target.json`, 'utf8')
    ),
    backend: readFileSync(`${root}.env.local`, 'utf8'),
    frontend: readFileSync(`${root}apps/web/.env.local`, 'utf8'),
    environment: process.env,
  });
  console.log(`Verified madearga/ruang target: ${selection.deployment}`);
  if (mode !== 'check') {
    // Runtime selection must come from the deployment-scoped key that the
    // guard just verified, not from a CONVEX_DEPLOYMENT value: resolving the
    // project through the ambient account fails for a deployment that the
    // account cannot see, and a stale ambient value could select another
    // deployment. Stale CONVEX_* selection values are stripped.
    const credential = keyDeployment(process.env.CONVEX_DEPLOY_KEY ?? process.env.CONVEX_DEPLOYMENT_TOKEN);
    if (!credential || credential.type !== 'dev' || `dev:${credential.name}` !== selection.deployment) {
      throw new Error(
        'Source .local/ruang-deploy.env (a deploy key for the pinned deployment) before running this command.'
      );
    }
    const childEnv = { ...process.env };
    delete childEnv.CONVEX_DEPLOYMENT;
    delete childEnv.CONVEX_CLOUD_URL;
    delete childEnv.CONVEX_SITE_URL;
    const args =
      mode === 'seed'
        ? [
            'exec',
            'convex',
            'run',
            'seed:seed',
          ]
        : ['exec', 'convex', 'dev'];
    if (mode === 'push') args.push('--once');
    const result = spawnSync('pnpm', args, {
      cwd: root,
      stdio: 'inherit',
      env: childEnv,
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(`Convex command blocked: ${error.message}`);
  process.exitCode = 1;
}
