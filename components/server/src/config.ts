/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { AuthProviderParams, normalizeAuthProviderParams } from './auth/auth-provider';

import { NamedWorkspaceFeatureFlag } from '@gitpod/gitpod-protocol';

import { RateLimiterConfig } from './auth/rate-limiter';
import { CodeSyncConfig } from './code-sync/code-sync-service';
import { ChargebeeProviderOptions, readOptionsFromFile } from '@gitpod/gitpod-payment-endpoint/lib/chargebee';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { log, LogrusLogLevel } from '@gitpod/gitpod-protocol/lib/util/logging';
import { filePathTelepresenceAware, KubeStage, translateLegacyStagename } from '@gitpod/gitpod-protocol/lib/env';

export const Config = Symbol('Config');
export type Config = Omit<ConfigSerialized, 'hostUrl' | 'chargebeeProviderOptionsFile'> & {
  stage: KubeStage;
  hostUrl: GitpodHostUrl;
  workspaceDefaults: WorkspaceDefaults;
  chargebeeProviderOptions?: ChargebeeProviderOptions;
};

export interface WorkspaceDefaults {
  workspaceImage: string;
  previewFeatureFlags: NamedWorkspaceFeatureFlag[];
  defaultFeatureFlags: NamedWorkspaceFeatureFlag[];
}

export interface WorkspaceGarbageCollection {
  disabled: boolean;
  startDate: number;
  chunkLimit: number;
  minAgeDays: number;
  minAgePrebuildDays: number;
  contentRetentionPeriodDays: number;
  contentChunkLimit: number;
}

/**
 * This is the config shape as found in the configuration file, e.g. server-configmap.yaml
 */
export interface ConfigSerialized {
  version: string;
  hostUrl: string;
  installationShortname: string;
  stage: string;
  devBranch?: string;
  insecureNoDomain: boolean;
  logLevel: LogrusLogLevel;

  // Use one or other - licenseFile reads from a file and populates license
  license?: string;
  licenseFile?: string;

  workspaceHeartbeat: {
    intervalSeconds: number;
    timeoutSeconds: number;
  };

  workspaceDefaults: Omit<WorkspaceDefaults, 'ideImage'>;

  session: {
    maxAgeMs: number;
    secret: string;
  };

  githubApp?: {
    enabled: boolean;
    appId: number;
    baseUrl?: string;
    webhookSecret: string;
    authProviderId: string;
    certPath: string;
    marketplaceName: string;
  };

  definitelyGpDisabled: boolean;

  workspaceGarbageCollection: WorkspaceGarbageCollection;

  enableLocalApp: boolean;

  authProviderConfigs: AuthProviderParams[];
  authProviderConfigFiles: string[];
  builtinAuthProvidersConfigured: boolean;
  disableDynamicAuthProviderLogin: boolean;

  /**
   * The maximum number of environment variables a user can have configured in their list at any given point in time.
   * Note: This limit should be so high that no regular user ever reaches it.
   */
  maxEnvvarPerUserCount: number;

  /** maxConcurrentPrebuildsPerRef is the maximum number of prebuilds we allow per ref type at any given time */
  maxConcurrentPrebuildsPerRef: number;

  incrementalPrebuilds: {
    repositoryPasslist: string[];
    commitHistory: number;
  };

  blockNewUsers: {
    enabled: boolean;
    passlist: string[];
  };

  makeNewUsersAdmin: boolean;

  /** this value - if present - overrides the default naming scheme for the GCloud bucket that Theia Plugins are stored in */
  theiaPluginsBucketNameOverride?: string;

  /** defaultBaseImageRegistryWhitelist is the list of registryies users get acces to by default */
  defaultBaseImageRegistryWhitelist: string[];

  runDbDeleter: boolean;

  oauthServer: {
    enabled: boolean;
    jwtSecret: string;
  };

  /**
   * The configuration for the rate limiter we (mainly) use for the websocket API
   */
  rateLimiter: RateLimiterConfig;

  /**
   * The address content service clients connect to
   * Example: content-service:8080
   */
  contentServiceAddr: string;

  /**
   * The address content service clients connect to
   * Example: image-builder:8080
   */
  imageBuilderAddr: string;

  codeSync: CodeSyncConfig;

  vsxRegistryUrl: string;

  /**
   * Payment related options
   */
  chargebeeProviderOptionsFile?: string;
  enablePayment?: boolean;
}

export namespace ConfigFile {
  export function fromFile(path: string | undefined = process.env.CONFIG_PATH): Config {
    if (!path) {
      throw new Error('config load error: CONFIG_PATH not set!');
    }
    try {
      const configStr = fs.readFileSync(filePathTelepresenceAware(path), { encoding: 'utf-8' }).toString();
      const configSerialized: ConfigSerialized = JSON.parse(configStr);
      return loadAndCompleteConfig(configSerialized);
    } catch (err) {
      log.error('config parse error', err);
      process.exit(1);
    }
  }

  function loadAndCompleteConfig(config: ConfigSerialized): Config {
    const hostUrl = new GitpodHostUrl(config.hostUrl);
    let authProviderConfigs: AuthProviderParams[] = [];
    const rawProviderConfigs = config.authProviderConfigs;
    if (rawProviderConfigs) {
      /* Add raw provider data */
      authProviderConfigs.push(...rawProviderConfigs);
    }
    const rawProviderConfigFiles = config.authProviderConfigFiles;
    if (rawProviderConfigFiles) {
      /* Add providers from files */
      const authProviderConfigFiles: AuthProviderParams[] = rawProviderConfigFiles.map<AuthProviderParams>(
        (providerFile) => {
          const rawProviderData = fs.readFileSync(filePathTelepresenceAware(providerFile), 'utf-8');

          return yaml.load(rawProviderData) as AuthProviderParams;
        },
      );

      authProviderConfigs.push(...authProviderConfigFiles);
    }
    authProviderConfigs = normalizeAuthProviderParams(authProviderConfigs);

    const builtinAuthProvidersConfigured = authProviderConfigs.length > 0;
    const chargebeeProviderOptions = readOptionsFromFile(
      filePathTelepresenceAware(config.chargebeeProviderOptionsFile || ''),
    );
    let license = config.license;
    const licenseFile = config.licenseFile;
    if (licenseFile) {
      license = fs.readFileSync(filePathTelepresenceAware(licenseFile), 'utf-8');
    }
    return {
      ...config,
      stage: translateLegacyStagename(config.stage),
      hostUrl,
      authProviderConfigs,
      builtinAuthProvidersConfigured,
      chargebeeProviderOptions,
      license,
      workspaceGarbageCollection: {
        ...config.workspaceGarbageCollection,
        startDate: config.workspaceGarbageCollection.startDate
          ? new Date(config.workspaceGarbageCollection.startDate).getTime()
          : Date.now(),
      },
    };
  }
}
