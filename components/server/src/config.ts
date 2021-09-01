/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { AuthProviderParams, normalizeAuthProviderParamsFromEnv } from './auth/auth-provider';

import { Branding, NamedWorkspaceFeatureFlag } from '@gitpod/gitpod-protocol';

import { RateLimiterConfig } from './auth/rate-limiter';
import { CodeSyncConfig } from './code-sync/code-sync-service';
import { ChargebeeProviderOptions, readOptionsFromFile } from "@gitpod/gitpod-payment-endpoint/lib/chargebee";
import * as fs from 'fs';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { filePathTelepresenceAware, KubeStage, translateLegacyStagename } from '@gitpod/gitpod-protocol/lib/env';
import { BrandingParser } from './branding-parser';
import { Env } from './env';
import { EnvEE } from '../ee/src/env';

export const Config = Symbol("Config");
export type Config = Omit<ConfigSerialized, "hostUrl" | "chargebeeProviderOptionsFile"> & {
    stage: KubeStage;
    hostUrl: GitpodHostUrl;
    workspaceDefaults: WorkspaceDefaults;
    chargebeeProviderOptions?: ChargebeeProviderOptions;
}

export interface WorkspaceDefaults {
    ideVersion: string;
    ideImageRepo: string;
    ideImage: string;
    ideImageAliases: { [index: string]: string };
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
    devBranch: string;
    insecureNoDomain: boolean;

    license?: string;

    workspaceHeartbeat: {
        intervalSeconds: number;
        timeoutSeconds: number,
    };

    workspaceDefaults: Omit<WorkspaceDefaults, "ideImage">;

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
        logLevel?: string;
    };

    definitelyGpDisabled: boolean;

    workspaceGarbageCollection: WorkspaceGarbageCollection;

    enableLocalApp: boolean;

    authProviderConfigs: AuthProviderParams[];
    builtinAuthProvidersConfigured: boolean;
    disableDynamicAuthProviderLogin: boolean;

    brandingConfig: Branding;

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
    }

    makeNewUsersAdmin: boolean;

    /** this value - if present - overrides the default naming scheme for the GCloud bucket that Theia Plugins are stored in */
    theiaPluginsBucketNameOverride?: string;

    /** defaultBaseImageRegistryWhitelist is the list of registryies users get acces to by default */
    defaultBaseImageRegistryWhitelist: string[];

    runDbDeleter: boolean;

    oauthServer: {
        enabled: boolean;
        jwtSecret: string;
    }

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

    /**
     * Payment related options
     */
    chargebeeProviderOptionsFile?: string;
    enablePayment?: boolean;
}

export namespace ConfigFile {
    export function fromFile(path: string | undefined = process.env.CONFIG_PATH): Config {
        if (!path) {
            throw new Error("config load error: CONFIG_PATH not set!");
        }
        try {
            const configStr = fs.readFileSync(filePathTelepresenceAware(path), { encoding: "utf-8" }).toString();
            const configSerialized: ConfigSerialized = JSON.parse(configStr);
            return loadAndCompleteConfig(configSerialized);
        } catch (err) {
            log.error("config parse error", err);
            process.exit(1);
        }
    }

    function loadAndCompleteConfig(config: ConfigSerialized): Config {
        const hostUrl = new GitpodHostUrl(config.hostUrl);
        let authProviderConfigs = config.authProviderConfigs
        if (authProviderConfigs) {
            authProviderConfigs = normalizeAuthProviderParamsFromEnv(authProviderConfigs);
        }
        const builtinAuthProvidersConfigured = authProviderConfigs.length > 0;
        const chargebeeProviderOptions = readOptionsFromFile(filePathTelepresenceAware(config.chargebeeProviderOptionsFile || ""));
        let brandingConfig = config.brandingConfig;
        if (brandingConfig) {
            brandingConfig = BrandingParser.normalize(brandingConfig);
        }
        const ideImage = `${config.workspaceDefaults.ideImageRepo}:${config.workspaceDefaults.ideVersion}`;
        return {
            ...config,
            stage: translateLegacyStagename(config.stage),
            hostUrl,
            authProviderConfigs,
            builtinAuthProvidersConfigured,
            brandingConfig,
            chargebeeProviderOptions,
            workspaceDefaults: {
                ...config.workspaceDefaults,
                ideImage,
                ideImageAliases: {
                    ...config.workspaceDefaults.ideImageAliases,
                    "theia": ideImage,
                }
            },
            workspaceGarbageCollection: {
                ...config.workspaceGarbageCollection,
                startDate: config.workspaceGarbageCollection.startDate ? new Date(config.workspaceGarbageCollection.startDate).getTime() : Date.now(),
            },
        }
    }
}

// TODO(gpl) Remove after config is deployed.
export namespace ConfigEnv {
    export function validateAgainstConfigFromEnv(_n: Config, _o: Config): boolean {
        const deepCopySorted = <T>(unordered: T): T => Object.keys(unordered).sort().reduce(
            (obj, key) => {
                let val = (unordered as any)[key];
                if (typeof val === "object") {
                    val = deepCopySorted(val);
                }
                (obj as any)[key] = val;
                return obj as T;
            },
            {} as T
        );
        const n = deepCopySorted(_n);
        const o = deepCopySorted(_o);

        // Changed
        if (o.githubApp?.enabled === false && n.githubApp?.enabled === false) {
            delete (n as any).githubApp;
            delete (o as any).githubApp;
        }

        // Unique
        delete (n as any).workspaceGarbageCollection.startDate;
        delete (o as any).workspaceGarbageCollection.startDate;

        delete (n as any).oauthServer.jwtSecret;
        delete (o as any).oauthServer.jwtSecret;

        log.info('config', { config: JSON.stringify(n, undefined, 2) });
        log.info('oldConfig', { oldConfig: JSON.stringify(o, undefined, 2) });

        return JSON.stringify(n, undefined, 2) === JSON.stringify(o, undefined, 2);
    }
    export function fromEnv(env: Env): Config {
        const config: Config = {
            version: env.version,
            hostUrl: env.hostUrl,
            installationShortname: env.installationShortname,
            devBranch: env.devBranch,
            stage: env.kubeStage,
            builtinAuthProvidersConfigured: env.builtinAuthProvidersConfigured,
            license: env.gitpodLicense,
            workspaceHeartbeat: {
                intervalSeconds: env.theiaHeartbeatInterval / 1000,
                timeoutSeconds: env.workspaceUserTimeout / 1000,
            },
            workspaceDefaults: {
                ideVersion: env.theiaVersion,
                ideImageRepo: env.theiaImageRepo,
                ideImage: env.ideDefaultImage,
                ideImageAliases: env.ideImageAliases,
                workspaceImage: env.workspaceDefaultImage,
                previewFeatureFlags: env.previewFeatureFlags,
                defaultFeatureFlags: env.defaultFeatureFlags,
            },
            session: {
                maxAgeMs: env.sessionMaxAgeMs,
                secret: env.sessionSecret,
            },
            githubApp: {
                enabled: env.githubAppEnabled,
                appId: env.githubAppAppID,
                webhookSecret: env.githubAppWebhookSecret,
                authProviderId: env.githubAppAuthProviderId,
                certPath: env.githubAppCertPath,
                marketplaceName: env.githubAppMarketplaceName,
                logLevel: env.githubAppLogLevel,
            },
            definitelyGpDisabled: env.definitelyGpDisabled,
            workspaceGarbageCollection: {
                disabled: env.garbageCollectionDisabled,
                startDate: env.garbageCollectionStartDate,
                chunkLimit: env.garbageCollectionLimit,
                minAgeDays: env.daysBeforeGarbageCollection,
                minAgePrebuildDays: env.daysBeforeGarbageCollectingPrebuilds,
                contentRetentionPeriodDays: env.workspaceDeletionRetentionPeriodDays,
                contentChunkLimit: env.workspaceDeletionLimit,
            },
            enableLocalApp: env.enableLocalApp,
            authProviderConfigs: env.authProviderConfigs,
            disableDynamicAuthProviderLogin: env.disableDynamicAuthProviderLogin,
            brandingConfig: env.brandingConfig,
            maxEnvvarPerUserCount: env.maxUserEnvvarCount,
            maxConcurrentPrebuildsPerRef: env.maxConcurrentPrebuildsPerRef,
            incrementalPrebuilds: {
                repositoryPasslist: env.incrementalPrebuildsRepositoryPassList,
                commitHistory: env.incrementalPrebuildsCommitHistory,
            },
            blockNewUsers: {
                enabled: env.blockNewUsers,
                passlist: env.blockNewUsersPassList,
            },
            makeNewUsersAdmin: env.makeNewUsersAdmin,
            theiaPluginsBucketNameOverride: env.theiaPluginsBucketNameOverride,
            defaultBaseImageRegistryWhitelist: env.defaultBaseImageRegistryWhitelist,
            insecureNoDomain: env.insecureNoDomain,
            runDbDeleter: env.runDbDeleter,
            oauthServer: {
                enabled: env.enableOAuthServer,
                jwtSecret: env.oauthServerJWTSecret,
            },
            rateLimiter: env.rateLimiter,
            contentServiceAddr: env.contentServiceAddress,
            imageBuilderAddr: env.imageBuilderAddress,
            codeSync: env.codeSyncConfig,
        };

        return config;
    }
    export function fromEnvEE(env: EnvEE): Config {
        const config = ConfigEnv.fromEnv(env);
        return {
            ...config,
            chargebeeProviderOptions: env.chargebeeProviderOptions,
            enablePayment: env.enablePayment,
        }
    }
}