/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { AuthProviderParams, normalizeAuthProviderParams } from "./auth/auth-provider";

import { NamedWorkspaceFeatureFlag } from "@gitpod/gitpod-protocol";

import { RateLimiterConfig } from "./auth/rate-limiter";
import { CodeSyncConfig } from "./code-sync/code-sync-service";
import { ChargebeeProviderOptions, readOptionsFromFile } from "@gitpod/gitpod-payment-endpoint/lib/chargebee";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { filePathTelepresenceAware } from "@gitpod/gitpod-protocol/lib/env";

export const Config = Symbol("Config");
export type Config = Omit<
    ConfigSerialized,
    | "blockedRepositories"
    | "hostUrl"
    | "chargebeeProviderOptionsFile"
    | "stripeSecretsFile"
    | "stripeConfigFile"
    | "licenseFile"
> & {
    hostUrl: GitpodHostUrl;
    workspaceDefaults: WorkspaceDefaults;
    chargebeeProviderOptions?: ChargebeeProviderOptions;
    stripeSecrets?: { publishableKey: string; secretKey: string };
    stripeConfig?: { usageProductPriceIds: { EUR: string; USD: string } };
    builtinAuthProvidersConfigured: boolean;
    blockedRepositories: { urlRegExp: RegExp; blockUser: boolean }[];
    inactivityPeriodForRepos?: number;
};

export interface WorkspaceDefaults {
    workspaceImage: string;
    previewFeatureFlags: NamedWorkspaceFeatureFlag[];
    defaultFeatureFlags: NamedWorkspaceFeatureFlag[];
    timeoutDefault?: string;
    timeoutExtended?: string;
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
    devBranch?: string;
    insecureNoDomain: boolean;

    // Use one or other - licenseFile reads from a file and populates license
    license?: string;
    licenseFile?: string;

    workspaceHeartbeat: {
        intervalSeconds: number;
        timeoutSeconds: number;
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
    };

    definitelyGpDisabled: boolean;

    workspaceGarbageCollection: WorkspaceGarbageCollection;

    enableLocalApp: boolean;

    authProviderConfigs: AuthProviderParams[];
    authProviderConfigFiles: string[];
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

    /**
     * The address usage service clients connect to
     * Example: usage:8080
     */
    usageServiceAddr: string;

    codeSync: CodeSyncConfig;

    vsxRegistryUrl: string;

    /**
     * Payment related options
     */
    chargebeeProviderOptionsFile?: string;
    stripeSecretsFile?: string;
    stripeConfigFile?: string;
    enablePayment?: boolean;

    /**
     * Number of prebuilds that can be started in the last 1 minute.
     * Key '*' specifies the default rate limit for a cloneURL, unless overriden by a specific cloneURL.
     */
    prebuildLimiter: { [cloneURL: string]: number } & { "*": number };

    /**
     * List of repositories not allowed to be used for workspace starts.
     * `blockUser` attribute to control handling of the user's account.
     */
    blockedRepositories?: { urlRegExp: string; blockUser: boolean }[];

    /**
     * If a numeric value interpreted as days is set, repositories not beeing opened with Gitpod are
     * considered inactive.
     */
    inactivityPeriodForRepos?: number;
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
                    const rawProviderData = fs.readFileSync(filePathTelepresenceAware(providerFile), "utf-8");

                    return yaml.load(rawProviderData) as AuthProviderParams;
                },
            );

            authProviderConfigs.push(...authProviderConfigFiles);
        }
        authProviderConfigs = normalizeAuthProviderParams(authProviderConfigs);

        const builtinAuthProvidersConfigured = authProviderConfigs.length > 0;
        const chargebeeProviderOptions = readOptionsFromFile(
            filePathTelepresenceAware(config.chargebeeProviderOptionsFile || ""),
        );
        let stripeSecrets: { publishableKey: string; secretKey: string } | undefined;
        if (config.enablePayment && config.stripeSecretsFile) {
            try {
                stripeSecrets = JSON.parse(
                    fs.readFileSync(filePathTelepresenceAware(config.stripeSecretsFile), "utf-8"),
                );
            } catch (error) {
                log.error("Could not load Stripe secrets", error);
            }
        }
        let stripeConfig: { usageProductPriceIds: { EUR: string; USD: string } } | undefined;
        if (config.enablePayment && config.stripeConfigFile) {
            try {
                stripeConfig = JSON.parse(fs.readFileSync(filePathTelepresenceAware(config.stripeConfigFile), "utf-8"));
            } catch (error) {
                log.error("Could not load Stripe config", error);
            }
        }
        let license = config.license;
        const licenseFile = config.licenseFile;
        if (licenseFile) {
            license = fs.readFileSync(filePathTelepresenceAware(licenseFile), "utf-8");
        }
        const blockedRepositories: { urlRegExp: RegExp; blockUser: boolean }[] = [];
        if (config.blockedRepositories) {
            for (const { blockUser, urlRegExp } of config.blockedRepositories) {
                blockedRepositories.push({
                    blockUser,
                    urlRegExp: new RegExp(urlRegExp),
                });
            }
        }
        let inactivityPeriodForRepos: number | undefined;
        if (typeof config.inactivityPeriodForRepos === "number") {
            if (config.inactivityPeriodForRepos >= 1) {
                inactivityPeriodForRepos = config.inactivityPeriodForRepos;
            }
        }
        return {
            ...config,
            hostUrl,
            authProviderConfigs,
            builtinAuthProvidersConfigured,
            chargebeeProviderOptions,
            stripeSecrets,
            stripeConfig,
            license,
            workspaceGarbageCollection: {
                ...config.workspaceGarbageCollection,
                startDate: config.workspaceGarbageCollection.startDate
                    ? new Date(config.workspaceGarbageCollection.startDate).getTime()
                    : Date.now(),
            },
            blockedRepositories,
            inactivityPeriodForRepos,
        };
    }
}
