/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { AuthProviderParams } from './auth/auth-provider';

import { Branding, NamedWorkspaceFeatureFlag } from '@gitpod/gitpod-protocol';

import { RateLimiterConfig } from './auth/rate-limiter';
import { Env } from './env';
import { CodeSyncConfig } from './code-sync/code-sync-service';

export const Config = Symbol("Config");
export interface Config {
    version: string;
    hostUrl: GitpodHostUrl;

    license: string | undefined;
    trialLicensePrivateKey: string | undefined;

    heartbeat: {
        intervalSeconds: number;
        timeoutSeconds: number,
    };

    workspaceDefaults: {
        ideVersion: string;
        ideImageRepo: string;
        ideImage: string;
        ideImageAliases: { [index: string]: string };
        workspaceImage: string;
        previewFeatureFlags: NamedWorkspaceFeatureFlag[];
        defaultFeatureFlags: NamedWorkspaceFeatureFlag[];
    };

    session: {
        maxAgeMs: number;
        secret: string;
    };

    // TODO(gpl): app.githubHost / GHE_HOST relevant ???
    githubApp: {
        enabled: boolean;
        appId: number;
        webhookSecret: string;
        authProviderId: string;
        certPath: string;
        marketplaceName: string;
        logLevel?: string;
    };

    definitelyGpDisabled: boolean;

    workspaceGarbageCollection: {
        disabled: boolean;
        startDate: number;
        chunkLimit: number;
        minAgeDays: number;
        minAgePrebuildDays: number;
        contentRetentionPeriodDays: number;
        contentChunkLimit: number;
    };

    enableLocalApp: boolean;

    authProviderConfigs: AuthProviderParams[];
    disableDynamicAuthProviderLogin: boolean;

    // TODO(gpl) Can we remove this?
    brandingConfig: Branding;

    /**
     * The maximum number of environment variables a user can have configured in their list at any given point in time.
     * Note: This limit should be so high that no regular user ever reaches it.
     */
    maxEnvvarPerUserCount: number;

    /** maxConcurrentPrebuildsPerRef is the maximum number of prebuilds we allow per ref type at any given time */
    maxConcurrentPrebuildsPerRef: number;

    incrementalPrebuilds: {
        repositoryPassList: string[];
        commitHistory: number;
    };

    blockNewUsers: {
        enabled: boolean;
        passlist: string[];
    }

    makeNewUsersAdmin: boolean;

    /** this value - if present - overrides the default naming scheme for the GCloud bucket that Theia Plugins are stored in */
    theiaPluginsBucketNameOverride: string | undefined;

    /** defaultBaseImageRegistryWhitelist is the list of registryies users get acces to by default */
    defaultBaseImageRegistryWhitelist: string[];

    // TODO(gpl): can we remove this? We never set the value anywhere it seems
    insecureNoDomain: boolean;

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
    contentServiceAddress: string;

    /**
     * TODO(gpl) Looks like this is not used anymore! Verify and remove
     */
    serverProxyApiKey?: string;

    codeSyncConfig: CodeSyncConfig;
}

export namespace EnvConfig {
    export function fromEnv(env: Env): Config {
        return {
            version: env.version,
            hostUrl: env.hostUrl,
            license: env.gitpodLicense,
            trialLicensePrivateKey: env.trialLicensePrivateKey,
            heartbeat: {
                intervalSeconds: env.theiaHeartbeatInterval,
                timeoutSeconds: env.workspaceUserTimeout,
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
                repositoryPassList: env.incrementalPrebuildsRepositoryPassList,
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
            contentServiceAddress: env.contentServiceAddress,
            serverProxyApiKey: env.serverProxyApiKey,
            codeSyncConfig: env.codeSyncConfig,
        };
    }
}