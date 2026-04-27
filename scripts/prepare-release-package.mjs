#!/usr/bin/env node

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (key) {
    args.set(key, value ?? '');
  }
}

const rootDir = process.cwd();
const outputDir = path.resolve(rootDir, args.get('--output') || 'dist/npm-package');
const libraryDir = path.resolve(rootDir, args.get('--library') || 'dist/ui-grid');
const elementDir = path.resolve(rootDir, args.get('--element') || 'dist/ui-grid-element');
const rootPackage = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
const sourcePackage = JSON.parse(await readFile(path.join(rootDir, 'projects/ui-grid/package.json'), 'utf8'));
const requestedVersion = args.get('--version') || rootPackage.version || sourcePackage.version || '0.1.0';

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

await cp(libraryDir, outputDir, { recursive: true });
await cp(elementDir, path.join(outputDir, 'element'), { recursive: true });
await cp(path.join(rootDir, 'README.md'), path.join(outputDir, 'README.md'));

const packageJsonPath = path.join(outputDir, 'package.json');
const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const entryTypes = packageJson.types || packageJson.typings || './index.d.ts';
const entryDefault = packageJson.module || packageJson.main || './fesm2022/ui-grid.mjs';

const finalPackageJson = {
  ...packageJson,
  name: sourcePackage.name,
  version: requestedVersion,
  private: false,
  sideEffects: false,
  publishConfig: {
    ...(sourcePackage.publishConfig || {}),
    access: 'public'
  },
  exports: {
    '.': {
      types: entryTypes,
      default: entryDefault
    },
    './element': './element/main.js',
    './package.json': './package.json'
  }
};

await writeFile(packageJsonPath, `${JSON.stringify(finalPackageJson, null, 2)}\n`);