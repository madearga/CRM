import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateConvexTarget } from './lib/convex-target.mjs';

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
    const args =
      mode === 'seed'
        ? [
            'exec',
            'convex',
            'run',
            'seed:seed',
            '--env-file',
            `${root}.env.local`,
          ]
        : ['exec', 'convex', 'dev', '--env-file', `${root}.env.local`];
    if (mode === 'push') args.push('--once');
    const result = spawnSync('pnpm', args, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, CONVEX_DEPLOYMENT: selection.deployment },
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  }
} catch (error) {
  console.error(`Convex command blocked: ${error.message}`);
  process.exitCode = 1;
}
