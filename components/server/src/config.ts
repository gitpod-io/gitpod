/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import { AuthProviderParams, normalizeAuthProviderParams } from "./auth/auth-provider";

import { NamedWorkspaceFeatureFlag } from "@gitpod/gitpod-protocol";

import { RateLimiterConfig } from "./auth/rate-limiter";
import { CodeSyncConfig } from "./code-sync/code-sync-service";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { filePathTelepresenceAware } from "@gitpod/gitpod-protocol/lib/env";
import { WorkspaceClassesConfig } from "./workspace/workspace-classes";
import { PrebuildRateLimiters } from "./workspace/prebuild-rate-limiter";
import { IRateLimiterOptions } from "rate-limiter-flexible";

export const Config = Symbol("Config");
export type Config = Omit<
    ConfigSerialized,
    "hostUrl" | "stripeSecretsFile" | "stripeConfigFile" | "linkedInSecretsFile" | "patSigningKeyFile" | "auth"
> & {
    hostUrl: GitpodHostUrl;
    workspaceDefaults: WorkspaceDefaults;
    stripeSecrets?: { publishableKey: string; secretKey: string };
    linkedInSecrets?: { clientId: string; clientSecret: string };
    builtinAuthProvidersConfigured: boolean;
    inactivityPeriodForReposInDays?: number;

    patSigningKey: string;
    admin: {
        loginKey?: string;
        // Absolute file path pointing to a file which contains admin credentials, encoded as JSON.
        credentialsPath: string;
    };

    auth: AuthConfig;
};

export interface AuthConfig {
    // Public/Private key for signing authenticated sessions
    pki: {
        signing: {
            id: string;
            privateKey: string;
            publicKey: string;
        };
        validating: {
            id: string;
            privateKey: string;
            publicKey: string;
        }[];
    };

    session: {
        lifetimeSeconds: number;
        issuer: string;
        cookie: CookieConfig;
    };
}

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

    /** The number of seconds between a run and the next */
    intervalSeconds: number;

    /** The maximum amount of workspaces that are marked as 'softDeleted' in one go */
    chunkLimit: number;

    /** The minimal age of a workspace before it is marked as 'softDeleted' (= hidden for the user) */
    minAgeDays: number;

    /** The minimal age of a prebuild (incl. workspace) before its content is deleted (+ marked as 'softDeleted') */
    minAgePrebuildDays: number;

    /** The minimal number of days a workspace has to stay in 'softDeleted' before its content is deleted */
    contentRetentionPeriodDays: number;

    /** The maximum amount of workspaces whose content is deleted in one go */
    contentChunkLimit: number;

    /** The minimal number of days a workspace has to stay in 'contentDeleted' before it's purged from the DB */
    purgeRetentionPeriodDays: number;

    /** The maximum amount of workspaces which are purged in one go */
    purgeChunkLimit: number;
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
    completeSnapshotJob?: { disabled?: boolean };

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

    blockNewUsers: {
        enabled: boolean;
        passlist: string[];
    };

    showSetupModal: boolean;

    admin: {
        credentialsPath: string;
    };

    /** defaultBaseImageRegistryWhitelist is the list of registryies users get acces to by default */
    defaultBaseImageRegistryWhitelist: string[];

    runDbDeleter: boolean;

    oauthServer: {
        enabled: boolean;
        jwtSecret: string;
    };

    /**
     * The configuration for the rate limiter we (mainly) use for the websocket API
     * @deprecated used for JSON-RPC API, for gRPC use rateLimits
     */
    rateLimiter: RateLimiterConfig;

    /**
     * The configuration for the rate limiter we use for the gRPC API.
     * As a primary means use RateLimited decorator.
     * Only use this if you need to adjst in production, make sure to apply changes to the decorator as well.
     * Key is of the form `<grpc_service>/<grpc_method>`
     */
    rateLimits?: {
        [key: string]: IRateLimiterOptions;
    };

    /**
     * The address content service clients connect to
     * Example: content-service:8080
     */
    contentServiceAddr: string;

    /**
     * The address usage service clients connect to
     * Example: usage:8080
     */
    usageServiceAddr: string;

    /**
     * The address ide service clients connect to
     * Example: ide-service:9001
     */
    ideServiceAddr: string;

    codeSync: CodeSyncConfig;

    vsxRegistryUrl: string;

    /*
     * The maximum event loop lag allowed before the liveness endpoint should return
     * an error code.
     */
    maximumEventLoopLag: number;

    /**
     * Payment related options
     */
    stripeSecretsFile?: string;
    stripeConfigFile?: string;
    enablePayment?: boolean;

    /**
     * LinkedIn OAuth2 configuration
     */
    linkedInSecretsFile?: string;

    /**
     * Number of prebuilds that can be started in a given time period.
     * Key '*' specifies the default rate limit for a cloneURL, unless overriden by a specific cloneURL.
     */
    prebuildLimiter: PrebuildRateLimiters;

    /**
     * If a numeric value interpreted as days is set, repositories not beeing opened with Gitpod are
     * considered inactive.
     */
    inactivityPeriodForReposInDays?: number;

    /**
     * Supported workspace classes
     */
    workspaceClasses: WorkspaceClassesConfig;

    /**
     * configuration for twilio
     */
    twilioConfig?: {
        serviceID: string;
        accountSID: string;
        authToken: string;
    };

    /**
     * File containing signing key for Personal Access Tokens
     * This is the same signing key used by Public API
     */
    patSigningKeyFile?: string;

    auth: {
        pki: AuthPKIConfig;
        session: {
            lifetimeSeconds: number;
            issuer: string;
            cookie: CookieConfig;
        };
    };

    redis: {
        address: string;
    };

    isSingleOrgInstallation: boolean;
}

export interface CookieConfig {
    name: string;
    maxAge: number;
    sameSite: boolean | "lax" | "strict" | "none";
    secure: boolean;
    httpOnly: boolean;
}

export interface AuthPKIConfig {
    signing: KeyPair;
    validating?: KeyPair[];
}

export interface KeyPair {
    id: string;
    publicKeyPath: string;
    privateKeyPath: string;
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
        let linkedInSecrets: { clientId: string; clientSecret: string } | undefined;
        if (config.linkedInSecretsFile) {
            try {
                linkedInSecrets = JSON.parse(
                    fs.readFileSync(filePathTelepresenceAware(config.linkedInSecretsFile), "utf-8"),
                );
            } catch (error) {
                log.error("Could not load LinkedIn secrets", error);
            }
        }

        let inactivityPeriodForReposInDays: number | undefined;
        if (typeof config.inactivityPeriodForReposInDays === "number") {
            if (config.inactivityPeriodForReposInDays >= 1) {
                inactivityPeriodForReposInDays = config.inactivityPeriodForReposInDays;
            }
        }

        const twilioConfigPath = "/twilio-config/config.json";
        let twilioConfig: Config["twilioConfig"];
        if (fs.existsSync(filePathTelepresenceAware(twilioConfigPath))) {
            try {
                twilioConfig = JSON.parse(fs.readFileSync(filePathTelepresenceAware(twilioConfigPath), "utf-8"));
            } catch (error) {
                log.error("Could not load Twilio config", error);
            }
        }

        if (config.workspaceClasses.filter((c) => c.isDefault).length !== 1) {
            log.error(
                "Exactly one default workspace class needs to be configured: " +
                    JSON.stringify(config.workspaceClasses),
            );
        }

        let patSigningKey = "";
        if (config.patSigningKeyFile) {
            try {
                patSigningKey = fs.readFileSync(filePathTelepresenceAware(config.patSigningKeyFile), "utf-8").trim();
            } catch (error) {
                log.error("Could not load Personal Access Token signing key", error);
            }
        }

        const authPKI: Config["auth"]["pki"] = {
            signing: {
                id: config.auth.pki.signing.id,
                privateKey: fs.readFileSync(filePathTelepresenceAware(config.auth.pki.signing.privateKeyPath), "utf-8"),
                publicKey: fs.readFileSync(filePathTelepresenceAware(config.auth.pki.signing.publicKeyPath), "utf-8"),
            },
            validating:
                config.auth.pki.validating?.map((keypair) => ({
                    id: keypair.id,
                    privateKey: fs.readFileSync(filePathTelepresenceAware(keypair.privateKeyPath), "utf-8"),
                    publicKey: fs.readFileSync(filePathTelepresenceAware(keypair.publicKeyPath), "utf-8"),
                })) || [],
        };

        return {
            ...config,
            hostUrl,
            authProviderConfigs,
            builtinAuthProvidersConfigured,
            stripeSecrets,
            linkedInSecrets,
            twilioConfig,
            workspaceGarbageCollection: {
                ...config.workspaceGarbageCollection,
                startDate: config.workspaceGarbageCollection.startDate
                    ? new Date(config.workspaceGarbageCollection.startDate).getTime()
                    : Date.now(),
            },
            inactivityPeriodForReposInDays,
            patSigningKey,
            admin: {
                ...config.admin,
                credentialsPath: config.admin.credentialsPath,
            },
            auth: {
                pki: authPKI,
                session: config.auth.session,
            },
        };
    }
}
