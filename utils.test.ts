import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { getPackages } from '@manypkg/get-packages';
import { discoverMonorepoPackages } from './utils';

async function fixture(t: TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'eco-ci-packages-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (file: string, content: string) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  };
  const manifest = (dir: string, data: object) =>
    write(path.join(dir, 'package.json'), JSON.stringify(data));
  await manifest('.', { name: 'monorepo', private: true });
  await write(
    'pnpm-workspace.yaml',
    'packages:\n  - packages/*\n  - e2e/**\n  - tools/*\n',
  );
  await manifest('packages/core', { name: '@rsbuild/core', version: '1.0.0' });
  return { root, write, manifest };
}

test('Rsbuild discovers publishable packages before validating workspace fixtures', async (t) => {
  const { root, manifest, write } = await fixture(t);
  await manifest('packages/create-rsbuild', { name: 'create-rsbuild' });
  await manifest('packages/private', { private: true });
  await manifest('packages/create-rsbuild/template', { name: 'template' });
  await manifest('e2e/browserslist', { private: true });
  await manifest('e2e/auto-external', { name: '@e2e/auto-external' });
  await manifest('tools/helper', { name: 'helper' });
  await write('packages/README.md', 'Package documentation');
  await write('packages/no-manifest/README.md', 'Not a package');
  await assert.rejects(getPackages(root), /missing the "name" field/);

  const expected = [
    { name: '@rsbuild/core', directory: path.join(root, 'packages/core') },
    {
      name: 'create-rsbuild',
      directory: path.join(root, 'packages/create-rsbuild'),
    },
  ];
  assert.deepEqual(await discoverMonorepoPackages('rsbuild', root), expected);

  // The old root workspaces field must not change the selected package set.
  await manifest('.', {
    name: 'monorepo',
    private: true,
    workspaces: ['packages/*'],
  });
  assert.deepEqual(await discoverMonorepoPackages('rsbuild', root), expected);
});

for (const stack of ['rstest', 'rslib', 'rsdoctor', 'rspress'] as const) {
  test(`${stack} retains workspace discovery outside packages/`, async (t) => {
    const { root, manifest } = await fixture(t);
    await manifest('tools/helper', { name: 'helper' });
    await manifest('e2e/private', { name: 'private-fixture', private: true });
    const { packages } = await getPackages(root);
    const expected = packages
      .filter((pkg) => pkg.packageJson.name && !pkg.packageJson.private)
      .map((pkg) => ({ name: pkg.packageJson.name, directory: pkg.dir }));
    assert(expected.some((pkg) => pkg.name === 'helper'));
    assert.deepEqual(await discoverMonorepoPackages(stack, root), expected);

    await manifest('e2e/missing-name', { private: true });
    await assert.rejects(
      discoverMonorepoPackages(stack, root),
      /missing the "name" field/,
    );
  });
}

test('Rsbuild rejects a missing public package name', async (t) => {
  const { root, manifest } = await fixture(t);
  await manifest('packages/core', { version: '1.0.0' });
  await assert.rejects(
    discoverMonorepoPackages('rsbuild', root),
    /Missing package name.*packages[/\\]core[/\\]package.json/,
  );
});

test('Rsbuild rejects duplicate public package names', async (t) => {
  const { root, manifest } = await fixture(t);
  await manifest('packages/duplicate', { name: '@rsbuild/core' });
  await assert.rejects(
    discoverMonorepoPackages('rsbuild', root),
    /Duplicate package name "@rsbuild\/core"/,
  );
});

test('Rsbuild propagates malformed package manifests', async (t) => {
  const { root, write } = await fixture(t);
  await write('packages/core/package.json', '{ broken');
  await assert.rejects(discoverMonorepoPackages('rsbuild', root), SyntaxError);
});

test('Rsbuild rejects a missing package directory', async (t) => {
  const { root } = await fixture(t);
  await fs.rm(path.join(root, 'packages'), { recursive: true });
  await assert.rejects(discoverMonorepoPackages('rsbuild', root), {
    code: 'ENOENT',
  });
});
