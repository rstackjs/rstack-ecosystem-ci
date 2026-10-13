import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { getRslintPackages, verifyRslintNativeBuild } from '../utils';

const stackPath = path.resolve(process.argv[2] ?? 'workspace/rslint');
const packages = getRslintPackages(stackPath);
verifyRslintNativeBuild(packages[1]);

const registry = 'http://localhost:4873';
const runId = process.env.GITHUB_RUN_ID;
const attempt = process.env.GITHUB_RUN_ATTEMPT;
assert(runId && attempt, 'Rslint publication requires a GitHub Actions run');

const manifests = packages.map((pkg) => ({
  ...pkg,
  file: path.join(pkg.directory, 'package.json'),
  manifest: JSON.parse(
    fs.readFileSync(path.join(pkg.directory, 'package.json'), 'utf8'),
  ),
}));
const currentVersion = manifests[0].manifest.version;
const version = `${currentVersion}-fresh.${runId}.${attempt}`;
for (const { name, manifest } of manifests) {
  assert.equal(manifest.name, name);
  assert.equal(
    manifest.version,
    currentVersion,
    `${name} and core must have matching source versions`,
  );
}
for (const { file, manifest } of manifests) {
  manifest.version = version;
  manifest.publishConfig = {
    ...manifest.publishConfig,
    registry,
    provenance: false,
  };
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

// Publish the host package first, then core. pnpm resolves workspace/catalog
// specs at publish time; unrelated versioned packages are left untouched.
for (const pkg of [...packages].reverse()) {
  await execa(
    'pnpm',
    [
      'publish',
      '--no-git-checks',
      '--provenance=false',
      '--access=public',
      '--tag=ecosystem-ci',
      `--registry=${registry}`,
      `--@rslint:registry=${registry}`,
    ],
    { cwd: pkg.directory, stdio: 'inherit' },
  );
}
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
}
console.log(`Published rslint ecosystem version ${version}`);
