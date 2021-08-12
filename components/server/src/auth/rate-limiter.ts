/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodServer } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";


export const accessCodeSyncStorage = 'accessCodeSyncStorage';
export const accesHeadlessLogs = 'accesHeadlessLogs';
type GitpodServerMethodType = keyof Omit<GitpodServer, "dispose" | "setClient"> | typeof accessCodeSyncStorage | typeof accesHeadlessLogs;
type GroupsConfig = {
    [key: string]: {
        points: number,
        durationsSec: number,
    }
}
type FunctionsConfig = {
    [K in GitpodServerMethodType]: {
        group: string,
        points: number,
    }
}
export type RateLimiterConfig = {
    groups: GroupsConfig,
    functions: FunctionsConfig,
};

function getConfig(config: RateLimiterConfig): RateLimiterConfig {
    const defaultGroups: GroupsConfig = {
        default: {
            points: 60000, // 1,000 calls per user per second
            durationsSec: 60,
        },
    }
    const defaultFunctions: FunctionsConfig = {
        "getLoggedInUser": { group: "default", points: 1 },
        "getTerms": { group: "default", points: 1 },
        "updateLoggedInUser": { group: "default", points: 1 },
        "getAuthProviders": { group: "default", points: 1 },
        "getOwnAuthProviders": { group: "default", points: 1 },
        "updateOwnAuthProvider": { group: "default", points: 1 },
        "deleteOwnAuthProvider": { group: "default", points: 1 },
        "getBranding": { group: "default", points: 1 },
        "getConfiguration": { group: "default", points: 1 },
        "getGitpodTokenScopes": { group: "default", points: 1 },
        "getToken": { group: "default", points: 1 },
        "getPortAuthenticationToken": { group: "default", points: 1 },
        "deleteAccount": { group: "default", points: 1 },
        "getClientRegion": { group: "default", points: 1 },
        "hasPermission": { group: "default", points: 1 },
        "getWorkspaces": { group: "default", points: 1 },
        "getWorkspaceOwner": { group: "default", points: 1 },
        "getWorkspaceUsers": { group: "default", points: 1 },
        "getFeaturedRepositories": { group: "default", points: 1 },
        "getWorkspace": { group: "default", points: 1 },
        "isWorkspaceOwner": { group: "default", points: 1 },
        "createWorkspace": { group: "default", points: 1 },
        "startWorkspace": { group: "default", points: 1 },
        "stopWorkspace": { group: "default", points: 1 },
        "deleteWorkspace": { group: "default", points: 1 },
        "setWorkspaceDescription": { group: "default", points: 1 },
        "controlAdmission": { group: "default", points: 1 },
        "updateWorkspaceUserPin": { group: "default", points: 1 },
        "sendHeartBeat": { group: "default", points: 1 },
        "watchWorkspaceImageBuildLogs": { group: "default", points: 1 },
        "isPrebuildDone": { group: "default", points: 1 },
        "getHeadlessLog": { group: "default", points: 1 },
        "setWorkspaceTimeout": { group: "default", points: 1 },
        "getWorkspaceTimeout": { group: "default", points: 1 },
        "getOpenPorts": { group: "default", points: 1 },
        "openPort": { group: "default", points: 1 },
        "closePort": { group: "default", points: 1 },
        "getUserStorageResource": { group: "default", points: 1 },
        "updateUserStorageResource": { group: "default", points: 1 },
        "getEnvVars": { group: "default", points: 1 },
        "getAllEnvVars": { group: "default", points: 1 },
        "setEnvVar": { group: "default", points: 1 },
        "deleteEnvVar": { group: "default", points: 1 },
        "getTeams": { group: "default", points: 1 },
        "getTeamMembers": { group: "default", points: 1 },
        "createTeam": { group: "default", points: 1 },
        "joinTeam": { group: "default", points: 1 },
        "setTeamMemberRole": { group: "default", points: 1 },
        "removeTeamMember": { group: "default", points: 1 },
        "getGenericInvite": { group: "default", points: 1 },
        "resetGenericInvite": { group: "default", points: 1 },
        "getProviderRepositoriesForUser":  { group: "default", points: 1 },
        "createProject":  { group: "default", points: 1 },
        "getTeamProjects": { group: "default", points: 1 },
        "getUserProjects": { group: "default", points: 1 },
        "deleteProject":  { group: "default", points: 1 },
        "findPrebuilds":  { group: "default", points: 1 },
        "getProjectOverview":  { group: "default", points: 1 },
        "triggerPrebuild":  { group: "default", points: 1 },
        "setProjectConfiguration":  { group: "default", points: 1 },
        "fetchProjectRepositoryConfiguration":  { group: "default", points: 1 },
        "guessProjectConfiguration":  { group: "default", points: 1 },
        "getContentBlobUploadUrl": { group: "default", points: 1 },
        "getContentBlobDownloadUrl": { group: "default", points: 1 },
        "getGitpodTokens": { group: "default", points: 1 },
        "generateNewGitpodToken": { group: "default", points: 1 },
        "deleteGitpodToken": { group: "default", points: 1 },
        "sendFeedback": { group: "default", points: 1 },
        "registerGithubApp": { group: "default", points: 1 },
        "takeSnapshot": { group: "default", points: 1 },
        "getSnapshots": { group: "default", points: 1 },
        "storeLayout": { group: "default", points: 1 },
        "getLayout": { group: "default", points: 1 },
        "preparePluginUpload": { group: "default", points: 1 },
        "resolvePlugins": { group: "default", points: 1 },
        "installUserPlugins": { group: "default", points: 1 },
        "uninstallUserPlugin": { group: "default", points: 1 },
        "guessGitTokenScopes": { group: "default", points: 1 },

        "adminGetUsers": { group: "default", points: 1 },
        "adminGetUser": { group: "default", points: 1 },
        "adminBlockUser": { group: "default", points: 1 },
        "adminDeleteUser": { group: "default", points: 1 },
        "adminModifyRoleOrPermission": { group: "default", points: 1 },
        "adminModifyPermanentWorkspaceFeatureFlag": { group: "default", points: 1 },
        "adminGetWorkspaces": { group: "default", points: 1 },
        "adminGetWorkspace": { group: "default", points: 1 },
        "adminForceStopWorkspace": { group: "default", points: 1 },
        "adminRestoreSoftDeletedWorkspace": { group: "default", points: 1 },
        "adminSetLicense": { group: "default", points: 1 },

        "validateLicense": { group: "default", points: 1 },
        "getLicenseInfo": { group: "default", points: 1 },
        "licenseIncludesFeature": { group: "default", points: 1 },

        "accessCodeSyncStorage": { group: "default", points: 1 },

        accesHeadlessLogs: { group: "default", points: 1 },

        "adminAddStudentEmailDomain":  { group: "default", points: 1 },
        "adminGetAccountStatement":  { group: "default", points: 1 },
        "adminIsStudent":  { group: "default", points: 1 },
        "adminSetProfessionalOpenSource":  { group: "default", points: 1 },
        "adminGrantExtraHours":  { group: "default", points: 1 },
        "checkout":  { group: "default", points: 1 },
        "createPortalSession":  { group: "default", points: 1 },
        "getAccountStatement":  { group: "default", points: 1 },
        "getAppliedCoupons":  { group: "default", points: 1 },
        "getAvailableCoupons":  { group: "default", points: 1 },
        "getChargebeeSiteId":  { group: "default", points: 1 },
        "getGithubUpgradeUrls":  { group: "default", points: 1 },
        "getPrivateRepoTrialEndDate":  { group: "default", points: 1 },
        "getRemainingUsageHours":  { group: "default", points: 1 },
        "getShowPaymentUI":  { group: "default", points: 1 },
        "isChargebeeCustomer":  { group: "default", points: 1 },
        "isStudent":  { group: "default", points: 1 },
        "mayAccessPrivateRepo":  { group: "default", points: 1 },
        "subscriptionCancel":  { group: "default", points: 1 },
        "subscriptionCancelDowngrade":  { group: "default", points: 1 },
        "subscriptionDowngradeTo":  { group: "default", points: 1 },
        "subscriptionUpgradeTo":  { group: "default", points: 1 },
        "tsAddSlots":  { group: "default", points: 1 },
        "tsAssignSlot":  { group: "default", points: 1 },
        "tsDeactivateSlot":  { group: "default", points: 1 },
        "tsGet":  { group: "default", points: 1 },
        "tsGetSlots":  { group: "default", points: 1 },
        "tsGetUnassignedSlot":  { group: "default", points: 1 },
        "tsReactivateSlot":  { group: "default", points: 1 },
        "tsReassignSlot":  { group: "default", points: 1 },
        "trackEvent":  { group: "default", points: 1 },
        "trackLocation": { group: "default", points: 1}
    };

    return {
        groups: { ...defaultGroups, ...config.groups },
        functions: { ...defaultFunctions, ...config.functions }
    };
}

export interface RateLimiter {
    user: string
    consume(method: string): Promise<RateLimiterRes>
}

export class UserRateLimiter {

    private static instance_: UserRateLimiter;

    public static instance(config: RateLimiterConfig): UserRateLimiter {
        if (!UserRateLimiter.instance_) {
            UserRateLimiter.instance_ = new UserRateLimiter(config);
        }
        return UserRateLimiter.instance_;
    }

    private readonly config: RateLimiterConfig;
    private readonly limiters: { [key: string]: RateLimiterMemory };

    private constructor(config: RateLimiterConfig) {
        this.config = getConfig(config);
        this.limiters = {};
        Object.keys(this.config.groups).forEach(group => {
            this.limiters[group] = new RateLimiterMemory({
                keyPrefix: group,
                points: this.config.groups[group].points,
                duration: this.config.groups[group].durationsSec,
            });
        });
    }

    async consume(user: string, method: string): Promise<RateLimiterRes> {

        const group = this.config.functions[method as GitpodServerMethodType]?.group || "default";
        if (group !== this.config.functions[method as GitpodServerMethodType]?.group) {
            log.warn(`method '${method}' is not configured for a rate limiter, using 'default'`);
        }

        const limiter = this.limiters[group] || this.limiters["default"];
        if (!(group in this.limiters)) {
            log.warn(`method '${method}' is configured for a rate limiter '${group}' but this rate limiter does not exist, using 'default' instead`);
        }

        const points = this.config.functions[method as GitpodServerMethodType]?.points || 1
        return await limiter.consume(user, points);
    }
}
