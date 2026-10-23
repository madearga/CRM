const forbiddenOverrides = [
  'CONVEX_DEPLOY_KEY',
  'CONVEX_DEPLOYMENT_TOKEN',
  'CONVEX_SELF_HOSTED_URL',
  'CONVEX_SELF_HOSTED_ADMIN_KEY',
];

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

function requireValue(values, key, expected) {
  if (values[key] !== expected) {
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
  if (!/^dev:[a-z]+-[a-z]+-\d+$/.test(deployment)) {
    throw new Error(
      'The pinned target must be a cloud development deployment, not production.'
    );
  }

  const backendValues = selectionValues(backend);
  const frontendValues = selectionValues(frontend);
  for (const values of [backendValues, frontendValues, environment]) {
    for (const key of forbiddenOverrides) {
      if (values[key])
        throw new Error(
          `${key} can override deployment selection; remove it before using this command.`
        );
    }
  }

  const name = deployment.slice(4);
  const cloudUrl = `https://${name}.convex.cloud`;
  const siteUrl = `https://${name}.convex.site`;
  requireValue(backendValues, 'CONVEX_DEPLOYMENT', deployment);
  requireValue(backendValues, 'CONVEX_URL', cloudUrl);
  requireValue(backendValues, 'CONVEX_SITE_URL', siteUrl);
  requireValue(frontendValues, 'NEXT_PUBLIC_CONVEX_URL', cloudUrl);
  requireValue(frontendValues, 'NEXT_PUBLIC_CONVEX_SITE_URL', siteUrl);
  for (const [key, expected] of Object.entries({
    CONVEX_DEPLOYMENT: deployment,
    CONVEX_URL: cloudUrl,
    CONVEX_SITE_URL: siteUrl,
    NEXT_PUBLIC_CONVEX_URL: cloudUrl,
    NEXT_PUBLIC_CONVEX_SITE_URL: siteUrl,
  })) {
    if (environment[key]) requireValue(environment, key, expected);
  }
  return { deployment, cloudUrl, siteUrl };
}
