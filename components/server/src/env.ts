/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';

import { GitpodHostUrl } from '@gitpod/gitpod-protocol/lib/util/gitpod-host-url';
import { AbstractComponentEnv, getEnvVar } from '@gitpod/gitpod-protocol/lib/env';
import { AuthProviderParams, parseAuthProviderParamsFromEnv } from './auth/auth-provider';

import { Branding, NamedWorkspaceFeatureFlag, WorkspaceFeatureFlags } from '@gitpod/gitpod-protocol';

import { BrandingParser } from './branding-parser';
import { RateLimiterConfig } from './auth/rate-limiter';

@injectable()
export class Env extends AbstractComponentEnv {
    readonly version: string = getEnvVar('VERSION');

    readonly serverVersion = process.env.SERVER_VERSION || 'dev';
    readonly hostUrl = new GitpodHostUrl(process.env.HOST_URL || 'https://gitpod.io');

    get theiaHeartbeatInterval() {
        const envValue = process.env.THEIA_HEARTBEAT_INTERVAL;
        return envValue ? parseInt(envValue, 10) : (1 * 60 * 1000);
    }
    get workspaceUserTimeout() {
        const envValue = process.env.WORKSPACE_USER_TIMEOUT;
        return envValue ? parseInt(envValue, 10) : 5 * this.theiaHeartbeatInterval;
    }

    readonly theiaVersion = process.env.THEIA_VERSION || this.serverVersion;
    readonly theiaImageRepo = process.env.THEIA_IMAGE_REPO || 'unknown';
    readonly ideDefaultImage = `${this.theiaImageRepo}:${this.theiaVersion}`;
    readonly workspaceDefaultImage = process.env.WORKSPACE_DEFAULT_IMAGE || "gitpod/workspace-full:latest";

    readonly ideImageAliases: { [index: string]: string } = (() => {
        const envValue = process.env.IDE_IMAGE_ALIASES;
        let res = !!envValue ? JSON.parse(envValue) : {};
        res["theia"] = this.ideDefaultImage;
        return res;
    })()

    readonly previewFeatureFlags: NamedWorkspaceFeatureFlag[] = (() => {
        return this.parseStringArray('EXPERIMENTAL_FEATURE_FLAGS') as NamedWorkspaceFeatureFlag[];
    })();

    protected parseStringArray(name: string): string[] {
        const json = process.env[name];
        if (!json) {
            return [];
        }
        let value;
        try {
            value = JSON.parse(json);
        } catch (error) {
            throw new Error(`Could not parse ${name}: ${error}`);
        }
        if (!Array.isArray(value) || value.some(e => typeof e !== 'string')) {
            throw `${name} should be an array of string: ${json}`;
        }
        return value;
    }

    readonly sessionMaxAgeMs: number = Number.parseInt(process.env.SESSION_MAX_AGE_MS || '259200000' /* 3 days */, 10);

    readonly githubAppEnabled: boolean = process.env.GITPOD_GITHUB_APP_ENABLED == "true";
    readonly githubAppAppID: number = process.env.GITPOD_GITHUB_APP_ID ? parseInt(process.env.GITPOD_GITHUB_APP_ID, 10) : 0;
    readonly githubAppWebhookSecret: string = process.env.GITPOD_GITHUB_APP_WEBHOOK_SECRET || "unknown";
    readonly githubAppAuthProviderId: string = process.env.GITPOD_GITHUB_APP_AUTH_PROVIDER_ID || "Public-GitHub";
    readonly githubAppCertPath: string = process.env.GITPOD_GITHUB_APP_CERT_PATH || "unknown";
    readonly githubAppMarketplaceName: string = process.env.GITPOD_GITHUB_APP_MKT_NAME || "unknown";
    readonly githubAppLogLevel?: string = process.env.LOG_LEVEL;
    readonly githubAppGHEHost?: string = process.env.GHE_HOST;

    readonly definitelyGpDisabled: boolean = process.env.GITPOD_DEFINITELY_GP_DISABLED == "true";

    readonly daysBeforeGarbageCollection: number = parseInt(process.env.GITPOD_DAYS_BEFORE_GARBAGE_COLLECTION || '14', 10);
    readonly daysBeforeGarbageCollectingPrebuilds: number = parseInt(process.env.GITPOD_DAYS_BEFORE_GARBAGE_COLLECTING_PREBUILDS || '7', 10);
    readonly garbageCollectionStartDate: number = process.env.GITPOD_GARBAGE_COLLECTION_START_DATE ?
        new Date(process.env.GITPOD_GARBAGE_COLLECTION_START_DATE).getTime():
        Date.now();
    readonly garbageCollectionLimit: number = parseInt(process.env.GITPOD_GARBAGE_COLLECTION_LIMIT || '1000', 10);

    readonly garbageCollectionDisabled: boolean = process.env.GITPOD_GARBAGE_COLLECTION_DISABLED === 'true';

    readonly workspaceDeletionRetentionPeriodDays: number = parseInt(process.env.GITPOD_WORKSPACE_DELETION_RETENTION_PERIOD_DAYS || '21', 10);
    readonly workspaceDeletionLimit: number = parseInt(process.env.GITPOD_WORKSPACE_DELETION_LIMIT || '1000', 10);

    readonly devBranch = process.env.DEV_BRANCH || '';

    readonly enableLocalApp = process.env.ENABLE_LOCAL_APP === "true";
    readonly enableOAuthServer = process.env.ENABLE_OAUTH_SERVER === "true";

    readonly authProviderConfigs = this.parseAuthProviderParams();

    protected parseAuthProviderParams(): AuthProviderParams[] {
        const envVar = getEnvVar('AUTH_PROVIDERS_CONFIG');
        return parseAuthProviderParamsFromEnv(JSON.parse(envVar));
    }

    readonly builtinAuthProvidersConfigured = this.authProviderConfigs.length > 0;

    readonly brandingConfig = this.parseBrandingConfig();

    protected parseBrandingConfig(): Branding {
        const envVar = getEnvVar('BRANDING_CONFIG');
        return BrandingParser.parse(envVar);
    }

    readonly gitpodLicense: string | undefined = process.env.GITPOD_LICENSE;

    // this limit should be so high that no regular user ever reaches it
    readonly maxUserEnvvarCount = Number.parseInt(process.env.MAX_USER_ENVVAR_COUNT || '4048', 10) || 4048;

    // maxConcurrentPrebuildsPerRef is the maximum number of prebuilds we allow per ref type at any given time
    readonly maxConcurrentPrebuildsPerRef = Number.parseInt(process.env.MAX_CONCUR_PREBUILDS_PER_REF || '10', 10) || 10;

    readonly incrementalPrebuildsRepositoryPassList: string[] = (() => {
        try {
            return this.parseStringArray('INCREMENTAL_PREBUILDS_REPO_PASSLIST');
        } catch (error) {
            console.error(error);
            return [];
        }
    })()
    readonly incrementalPrebuildsCommitHistory: number = Number.parseInt(process.env.INCREMENTAL_PREBUILDS_COMMIT_HISTORY || '100', 10) || 100;

    protected parseBool(name: string) {
        return getEnvVar(name, 'false') === 'true';
    }

    readonly blockNewUsers: boolean = this.parseBool("BLOCK_NEW_USERS");
    readonly blockNewUsersPassList: string[] = (() => {
        try {
            return this.parseStringArray('BLOCK_NEW_USERS_PASSLIST');
        } catch (error) {
            console.error(error);
            return [];
        }
    })();
    readonly makeNewUsersAdmin: boolean = this.parseBool("MAKE_NEW_USERS_ADMIN");
    readonly disableDynamicAuthProviderLogin: boolean = this.parseBool("DISABLE_DYNAMIC_AUTH_PROVIDER_LOGIN");

    /** This value - if present - overrides the default naming scheme for the GCloud bucket that Theia Plugins are stored in */
    readonly theiaPluginsBucketNameOverride: string | undefined = process.env['THEIA_PLUGINS_BUCKET_NAME_OVERRIDE'];

    /** defaultBaseImageRegistryWhitelist is the list of registryies users get acces to by default */
    readonly defaultBaseImageRegistryWhitelist: string[] = (() => {
        return this.parseStringArray('GITPOD_BASEIMG_REGISTRY_WHITELIST');
    })()

    readonly defaultFeatureFlags: NamedWorkspaceFeatureFlag[] = (() => {
        try {
            const r = (this.parseStringArray('GITPOD_DEFAULT_FEATURE_FLAGS') as NamedWorkspaceFeatureFlag[]);
            return r.filter(e => e in WorkspaceFeatureFlags);
        } catch (error) {
            console.error(error);
            return [];
        }
    })();

    // TODO(gpl): can we remove this?
    readonly insecureNoDomain: boolean = getEnvVar('SERVE_INSECURE_NO_DOMAIN', 'false') === 'true';

    readonly sessionSecret = this.parseSessionSecret();
    protected parseSessionSecret(): string {
        const envVar = getEnvVar('SESSION_SECRET');
        return envVar;
    }

    readonly runDbDeleter: boolean = getEnvVar('RUN_DB_DELETER', 'false') === 'true';

    readonly oauthServerJWTSecret = getEnvVar("OAUTH_SERVER_JWT_SECRET");

    readonly imageBuilderAddress = getEnvVar('IMAGE_BUILDER_SERVICE', "image-builder-mk3:8080");

    readonly rateLimiter: RateLimiterConfig = JSON.parse(process.env.RATE_LIMITER_CONFIG || "{}");

    readonly contentServiceAddress = process.env.CONTENT_SERVICE_ADDRESS || "content-service:8080";

    readonly codeSyncConfig = JSON.parse(process.env.CODE_SYNC_CONFIG || "{}");
}
