function selectionValues(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/
    );
    if (!match) continue;
    const [, key, raw] = match;
    if (!key.startsWith('CONVEX_') && !key.startsWith('NEXT_PUBLIC_CONVEX_'))
      continue;
    if (Object.hasOwn(values, key))
      throw new Error(`Duplicate deployment selection key: ${key}`);
    const quoted = raw.match(/^(["'])(.*?)\1\s*(?:#.*)?$/);
    values[key] = quoted ? quoted[2] : raw.split(/\s+#/)[0].trim();
  }
  return values;
}

/**
 * The deployment a deploy key targets, or null when the value is not a
 * deployment-scoped key. Keys look like `dev:name|payload`.
 */
export function keyDeployment(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(dev|prod|preview):([^|]+)\|/);
  if (!match) return null;
  return { type: match[1], name: match[2] };
}

function requireValue(values, key, expected) {
  if (values[key] !== expected) {
    throw new Error(
      `${key} does not match the pinned Ruang development deployment.`
    );
  }
}

function requireUrl(values, key, name, suffix) {
  const value = values[key];
  let host = null;
  if (typeof value === 'string') {
    try {
      host = new URL(value).hostname;
    } catch {
      host = null;
    }
  }
  if (!host || !host.startsWith(`${name}.`) || !host.endsWith(suffix)) {
    throw new Error(
      `${key} does not match the pinned Ruang development deployment.`
    );
  }
}

export function validateConvexTarget({
  target,
  backend,
  frontend,
  environment,
}) {
  if (target.team !== 'madearga' || target.project !== 'ruang') {
    throw new Error(
      'Only the madearga/ruang project is supported by this development command.'
    );
  }
  const deployment = target.developmentDeployment;
  if (!deployment)
    throw new Error(
      'A development deployment must be explicitly pinned before deployment.'
    );
  if (!/^dev:[a-z0-9]+(-[a-z0-9]+)+$/.test(deployment)) {
    throw new Error(
      'The pinned target must be a cloud development deployment, not production.'
    );
  }
  const name = deployment.slice(4);

  const backendValues = selectionValues(backend);
  const frontendValues = selectionValues(frontend);

  // A deployment-scoped key is the normal credential for a bootstrap push
  // from a server. It is accepted only when it targets exactly the pinned
  // development deployment; any other key, including a production or preview
  // one, is refused before the CLI runs.
  let hasMatchingKey = false;
  const sources = [
    ['the environment', environment],
    ['the backend env file', backendValues],
    ['the frontend env file', frontendValues],
  ];
  for (const [source, values] of sources) {
    for (const key of ['CONVEX_DEPLOY_KEY', 'CONVEX_DEPLOYMENT_TOKEN']) {
      if (!values[key]) continue;
      const targeted = keyDeployment(values[key]);
      if (!targeted || targeted.type !== 'dev' || targeted.name !== name) {
        throw new Error(
          `${key} in ${source} does not target the pinned deployment ${deployment}; remove it.`
        );
      }
      hasMatchingKey = true;
    }
    for (const key of ['CONVEX_SELF_HOSTED_URL', 'CONVEX_SELF_HOSTED_ADMIN_KEY']) {
      if (values[key])
        throw new Error(
          `${key} can override deployment selection; remove it before using this command.`
        );
    }
  }

  requireValue(backendValues, 'CONVEX_DEPLOYMENT', deployment);
  requireUrl(backendValues, 'CONVEX_URL', name, '.convex.cloud');
  requireUrl(backendValues, 'CONVEX_SITE_URL', name, '.convex.site');
  requireUrl(frontendValues, 'NEXT_PUBLIC_CONVEX_URL', name, '.convex.cloud');
  requireUrl(frontendValues, 'NEXT_PUBLIC_CONVEX_SITE_URL', name, '.convex.site');
  for (const [key, expected] of Object.entries({
    CONVEX_DEPLOYMENT: deployment,
    NEXT_PUBLIC_CONVEX_URL: backendValues.CONVEX_URL,
    NEXT_PUBLIC_CONVEX_SITE_URL: backendValues.CONVEX_SITE_URL,
  })) {
    // A matching key is the runtime credential and stale ambient selection
    // values are stripped from the child environment, so with a verified key
    // an ambient CONVEX_DEPLOYMENT cannot override anything and is ignored.
    if (environment[key] && !(hasMatchingKey && key === 'CONVEX_DEPLOYMENT')) {
      requireValue(environment, key, expected);
    }
  }
  return {
    deployment,
    cloudUrl: backendValues.CONVEX_URL,
    siteUrl: backendValues.CONVEX_SITE_URL,
  };
}
