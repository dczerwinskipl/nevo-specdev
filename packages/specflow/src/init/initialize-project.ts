import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, link, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { stringify } from 'yaml';

import {
  isGitIgnored,
  LOCAL_CONFIG_RELATIVE_PATH,
  LOCAL_IGNORE_ENTRY,
  type GitCheckoutLayout,
} from '@nevo/specflow-engine';

export interface ProjectConfigContribution {
  readonly projectConfig: Record<string, unknown>;
  readonly localConfig: Record<string, unknown>;
}

export interface ConfigWriteOptions {
  readonly local: boolean;
}

export interface InitializeProjectOptions {
  readonly layout: GitCheckoutLayout;
  readonly contribution: ProjectConfigContribution;
  readonly isIgnored?: (root: string, relativePath: string) => Promise<boolean>;
  readonly writeConfigFile?: (
    path: string,
    content: string,
    options: ConfigWriteOptions,
  ) => Promise<void>;
}

export interface InitializeProjectResult {
  readonly root: string;
  readonly projectConfigPath: string;
  readonly localConfigPath: string;
}

interface GitignoreSnapshot {
  readonly path: string;
  readonly existed: boolean;
  readonly content: string;
  readonly changed: boolean;
}

export async function assertProjectCanInitialize(layout: GitCheckoutLayout): Promise<void> {
  if (await fileExists(layout.projectConfigPath)) {
    throw new Error(`Nevo SpecFlow is already initialized: ${layout.projectConfigPath}`);
  }
  if (await fileExists(layout.localConfigPath)) {
    throw new Error(
      `Refusing to overwrite existing workstation-local SpecFlow config: ${layout.localConfigPath}`,
    );
  }
}

export async function initializeProject(
  options: InitializeProjectOptions,
): Promise<InitializeProjectResult> {
  const { layout } = options;
  await assertProjectCanInitialize(layout);

  const projectConfig = options.contribution.projectConfig;
  const localConfig = options.contribution.localConfig;
  const checkIgnored = options.isIgnored ?? isGitIgnored;
  const writeConfig = options.writeConfigFile ?? defaultWriteConfigFile;

  const gitignore = await ensureLocalIgnore(layout.root, checkIgnored);
  let localWritten = false;
  let projectWritten = false;

  try {
    await mkdir(dirname(layout.localConfigPath), { recursive: true });
    await mkdir(dirname(layout.projectConfigPath), { recursive: true });

    // Local config may contain secrets, so write it only after Git ignore has been
    // proven effective. The committed config is written last and is the success marker.
    await writeConfig(layout.localConfigPath, serializeConfig(localConfig), { local: true });
    localWritten = true;

    await writeConfig(layout.projectConfigPath, serializeConfig(projectConfig), { local: false });
    projectWritten = true;
  } catch (error) {
    if (projectWritten) {
      await rm(layout.projectConfigPath, { force: true });
    }
    if (localWritten) {
      await rm(layout.localConfigPath, { force: true });
    }
    await restoreGitignore(gitignore);
    throw error;
  }

  return {
    root: layout.root,
    projectConfigPath: layout.projectConfigPath,
    localConfigPath: layout.localConfigPath,
  };
}

function serializeConfig(value: unknown): string {
  return `${stringify(value, { lineWidth: 0 }).trimEnd()}\n`;
}

async function defaultWriteConfigFile(
  path: string,
  content: string,
  options: ConfigWriteOptions,
): Promise<void> {
  const stagedPath = `${path}.init.${randomUUID()}.tmp`;
  let published = false;

  try {
    await writeFile(stagedPath, content, {
      encoding: 'utf8',
      flag: 'wx',
      ...(options.local ? { mode: 0o600 } : {}),
    });

    try {
      await link(stagedPath, path);
      published = true;
    } catch (error) {
      if (isAlreadyExists(error)) {
        throw new Error(`Refusing to overwrite existing SpecFlow config: ${path}`, {
          cause: error,
        });
      }
      throw error;
    }

    await rm(stagedPath, { force: true });
  } catch (error) {
    if (published) {
      await rm(path, { force: true });
    }
    await rm(stagedPath, { force: true });
    throw error;
  }
}

async function ensureLocalIgnore(
  root: string,
  checkIgnored: (root: string, relativePath: string) => Promise<boolean>,
): Promise<GitignoreSnapshot> {
  const gitignorePath = join(root, '.gitignore');
  const existed = await fileExists(gitignorePath);
  const original = existed ? await readFile(gitignorePath, 'utf8') : '';
  let current = original;

  const lines = current.split(/\r?\n/u).map((line) => line.trim());
  if (!lines.includes(LOCAL_IGNORE_ENTRY)) {
    current = appendIgnoreRule(current);
    await writeFile(gitignorePath, current, 'utf8');
  }

  if (!(await checkIgnored(root, LOCAL_CONFIG_RELATIVE_PATH))) {
    if (current === original || !current.trimEnd().endsWith(LOCAL_IGNORE_ENTRY)) {
      current = appendIgnoreRule(current);
      await writeFile(gitignorePath, current, 'utf8');
    }

    if (!(await checkIgnored(root, LOCAL_CONFIG_RELATIVE_PATH))) {
      const snapshot = {
        path: gitignorePath,
        existed,
        content: original,
        changed: current !== original,
      };
      await restoreGitignore(snapshot);
      throw new Error(
        `Refusing to write workstation-local secrets because Git does not ignore ${LOCAL_CONFIG_RELATIVE_PATH}.`,
      );
    }
  }

  return {
    path: gitignorePath,
    existed,
    content: original,
    changed: current !== original,
  };
}

function appendIgnoreRule(content: string): string {
  const prefix = content.length === 0 ? '' : content.endsWith('\n') ? content : `${content}\n`;
  const separator = prefix.length === 0 || prefix.endsWith('\n\n') ? '' : '\n';
  return (
    `${prefix}${separator}# Nevo SpecFlow workstation-local configuration and state\n` +
    `${LOCAL_IGNORE_ENTRY}\n`
  );
}

async function restoreGitignore(snapshot: GitignoreSnapshot): Promise<void> {
  if (!snapshot.changed) return;

  if (snapshot.existed) {
    await writeFile(snapshot.path, snapshot.content, 'utf8');
  } else {
    await rm(snapshot.path, { force: true });
  }
}

function isAlreadyExists(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'EEXIST'
  );
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'ENOENT'
    ) {
      return false;
    }
    throw error;
  }
}
