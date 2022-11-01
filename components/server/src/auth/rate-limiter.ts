/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodServer } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

export const accessCodeSyncStorage = "accessCodeSyncStorage";
export const accessHeadlessLogs = "accessHeadlessLogs";
type GitpodServerMethodType =
    | keyof Omit<GitpodServer, "dispose" | "setClient">
    | typeof accessCodeSyncStorage
    | typeof accessHeadlessLogs;
type GroupKey = "default" | "startWorkspace" | "createWorkspace" | "phoneVerification";
type GroupsConfig = {
    [key: string]: {
        points: number;
        durationsSec: number;
    };
};
type FunctionsConfig = {
    [K in GitpodServerMethodType]: {
        group: GroupKey;
        points: number;
    };
};
export type RateLimiterConfig = {
    groups: GroupsConfig;
    functions: FunctionsConfig;
};

/**
 *
 * @param name
 * @returns True iff the name is a valid function of the GitpodServer interface. name is case sensitive.
 */
export function isValidFunctionName(name: string): boolean {
    const valid: boolean = !!defaultFunctions[name as any as GitpodServerMethodType];
    return valid;
}

const defaultFunctions: FunctionsConfig = {
    getLoggedInUser: { group: "default", points: 1 },
    getTerms: { group: "default", points: 1 },
    updateLoggedInUser: { group: "default", points: 1 },
    sendPhoneNumberVerificationToken: { group: "phoneVerification", points: 1 },
    verifyPhoneNumberVerificationToken: { group: "phoneVerification", points: 1 },
    getAuthProviders: { group: "default", points: 1 },
    getOwnAuthProviders: { group: "default", points: 1 },
    updateOwnAuthProvider: { group: "default", points: 1 },
    deleteOwnAuthProvider: { group: "default", points: 1 },
    getConfiguration: { group: "default", points: 1 },
    getGitpodTokenScopes: { group: "default", points: 1 },
    getToken: { group: "default", points: 1 },
    getPortAuthenticationToken: { group: "default", points: 1 },
    deleteAccount: { group: "default", points: 1 },
    getClientRegion: { group: "default", points: 1 },
    hasPermission: { group: "default", points: 1 },
    getWorkspaces: { group: "default", points: 1 },
    getWorkspaceOwner: { group: "default", points: 1 },
    getWorkspaceUsers: { group: "default", points: 1 },
    getFeaturedRepositories: { group: "default", points: 1 },
    getSuggestedContextURLs: { group: "default", points: 1 },
    getWorkspace: { group: "default", points: 1 },
    isWorkspaceOwner: { group: "default", points: 1 },
    getOwnerToken: { group: "default", points: 1 },
    createWorkspace: { group: "createWorkspace", points: 1 },
    startWorkspace: { group: "startWorkspace", points: 1 },
    stopWorkspace: { group: "default", points: 1 },
    deleteWorkspace: { group: "default", points: 1 },
    setWorkspaceDescription: { group: "default", points: 1 },
    controlAdmission: { group: "default", points: 1 },
    updateWorkspaceUserPin: { group: "default", points: 1 },
    sendHeartBeat: { group: "default", points: 1 },
    watchWorkspaceImageBuildLogs: { group: "default", points: 1 },
    isPrebuildDone: { group: "default", points: 1 },
    getHeadlessLog: { group: "default", points: 1 },
    setWorkspaceTimeout: { group: "default", points: 1 },
    getWorkspaceTimeout: { group: "default", points: 1 },
    getOpenPorts: { group: "default", points: 1 },
    openPort: { group: "default", points: 1 },
    closePort: { group: "default", points: 1 },
    getUserStorageResource: { group: "default", points: 1 },
    updateUserStorageResource: { group: "default", points: 1 },
    getEnvVars: { group: "default", points: 1 },
    getAllEnvVars: { group: "default", points: 1 },
    setEnvVar: { group: "default", points: 1 },
    deleteEnvVar: { group: "default", points: 1 },
    hasSSHPublicKey: { group: "default", points: 1 },
    getSSHPublicKeys: { group: "default", points: 1 },
    addSSHPublicKey: { group: "default", points: 1 },
    deleteSSHPublicKey: { group: "default", points: 1 },
    setProjectEnvironmentVariable: { group: "default", points: 1 },
    getProjectEnvironmentVariables: { group: "default", points: 1 },
    deleteProjectEnvironmentVariable: { group: "default", points: 1 },
    getTeam: { group: "default", points: 1 },
    getTeams: { group: "default", points: 1 },
    getTeamMembers: { group: "default", points: 1 },
    createTeam: { group: "default", points: 1 },
    joinTeam: { group: "default", points: 1 },
    setTeamMemberRole: { group: "default", points: 1 },
    removeTeamMember: { group: "default", points: 1 },
    getGenericInvite: { group: "default", points: 1 },
    resetGenericInvite: { group: "default", points: 1 },
    deleteTeam: { group: "default", points: 1 },
    getProviderRepositoriesForUser: { group: "default", points: 1 },
    createProject: { group: "default", points: 1 },
    getTeamProjects: { group: "default", points: 1 },
    getUserProjects: { group: "default", points: 1 },
    deleteProject: { group: "default", points: 1 },
    findPrebuilds: { group: "default", points: 1 },
    getPrebuild: { group: "default", points: 1 },
    findPrebuildByWorkspaceID: { group: "default", points: 1 },
    getProjectOverview: { group: "default", points: 1 },
    triggerPrebuild: { group: "default", points: 1 },
    cancelPrebuild: { group: "default", points: 1 },
    updateProjectPartial: { group: "default", points: 1 },
    getContentBlobUploadUrl: { group: "default", points: 1 },
    getContentBlobDownloadUrl: { group: "default", points: 1 },
    getGitpodTokens: { group: "default", points: 1 },
    generateNewGitpodToken: { group: "default", points: 1 },
    deleteGitpodToken: { group: "default", points: 1 },
    isGitHubAppEnabled: { group: "default", points: 1 },
    registerGithubApp: { group: "default", points: 1 },
    takeSnapshot: { group: "default", points: 1 },
    waitForSnapshot: { group: "default", points: 1 },
    getSnapshots: { group: "default", points: 1 },
    guessGitTokenScopes: { group: "default", points: 1 },

    adminGetUsers: { group: "default", points: 1 },
    adminGetUser: { group: "default", points: 1 },
    adminBlockUser: { group: "default", points: 1 },
    adminDeleteUser: { group: "default", points: 1 },
    adminVerifyUser: { group: "default", points: 1 },
    adminModifyRoleOrPermission: { group: "default", points: 1 },
    adminModifyPermanentWorkspaceFeatureFlag: { group: "default", points: 1 },
    adminGetTeams: { group: "default", points: 1 },
    adminGetTeamMembers: { group: "default", points: 1 },
    adminGetTeamById: { group: "default", points: 1 },
    adminSetTeamMemberRole: { group: "default", points: 1 },
    adminGetWorkspaces: { group: "default", points: 1 },
    adminGetWorkspace: { group: "default", points: 1 },
    adminForceStopWorkspace: { group: "default", points: 1 },
    adminRestoreSoftDeletedWorkspace: { group: "default", points: 1 },
    adminGetProjectsBySearchTerm: { group: "default", points: 1 },
    adminGetProjectById: { group: "default", points: 1 },
    adminFindPrebuilds: { group: "default", points: 1 },
    adminGetLicense: { group: "default", points: 1 },
    adminSetLicense: { group: "default", points: 1 },
    adminGetSettings: { group: "default", points: 1 },
    adminUpdateSettings: { group: "default", points: 1 },
    adminGetTelemetryData: { group: "default", points: 1 },
    adminGetBlockedRepositories: { group: "default", points: 1 },
    adminCreateBlockedRepository: { group: "default", points: 1 },
    adminDeleteBlockedRepository: { group: "default", points: 1 },
    adminGetBillingMode: { group: "default", points: 1 },

    validateLicense: { group: "default", points: 1 },
    getLicenseInfo: { group: "default", points: 1 },
    licenseIncludesFeature: { group: "default", points: 1 },

    accessCodeSyncStorage: { group: "default", points: 1 },

    accessHeadlessLogs: { group: "default", points: 1 },

    adminAddStudentEmailDomain: { group: "default", points: 1 },
    adminGetAccountStatement: { group: "default", points: 1 },
    adminIsStudent: { group: "default", points: 1 },
    adminSetProfessionalOpenSource: { group: "default", points: 1 },
    adminGrantExtraHours: { group: "default", points: 1 },
    checkout: { group: "default", points: 1 },
    teamCheckout: { group: "default", points: 1 },
    createPortalSession: { group: "default", points: 1 },
    createTeamPortalSession: { group: "default", points: 1 },
    getAccountStatement: { group: "default", points: 1 },
    getAppliedCoupons: { group: "default", points: 1 },
    getAvailableCoupons: { group: "default", points: 1 },
    getChargebeeSiteId: { group: "default", points: 1 },
    getGithubUpgradeUrls: { group: "default", points: 1 },
    getRemainingUsageHours: { group: "default", points: 1 },
    getShowPaymentUI: { group: "default", points: 1 },
    isChargebeeCustomer: { group: "default", points: 1 },
    isStudent: { group: "default", points: 1 },
    subscriptionCancel: { group: "default", points: 1 },
    subscriptionCancelDowngrade: { group: "default", points: 1 },
    subscriptionDowngradeTo: { group: "default", points: 1 },
    subscriptionUpgradeTo: { group: "default", points: 1 },
    tsAddSlots: { group: "default", points: 1 },
    tsAssignSlot: { group: "default", points: 1 },
    tsDeactivateSlot: { group: "default", points: 1 },
    getTeamSubscription: { group: "default", points: 1 },
    tsGet: { group: "default", points: 1 },
    tsGetSlots: { group: "default", points: 1 },
    tsGetUnassignedSlot: { group: "default", points: 1 },
    tsReactivateSlot: { group: "default", points: 1 },
    tsReassignSlot: { group: "default", points: 1 },
    getStripePublishableKey: { group: "default", points: 1 },
    getStripeSetupIntentClientSecret: { group: "default", points: 1 },
    findStripeSubscriptionId: { group: "default", points: 1 },
    createStripeCustomerIfNeeded: { group: "default", points: 1 },
    subscribeToStripe: { group: "default", points: 1 },
    getStripePortalUrl: { group: "default", points: 1 },
    listUsage: { group: "default", points: 1 },
    getBillingModeForTeam: { group: "default", points: 1 },
    getBillingModeForUser: { group: "default", points: 1 },

    trackEvent: { group: "default", points: 1 },
    trackLocation: { group: "default", points: 1 },
    identifyUser: { group: "default", points: 1 },
    getIDEOptions: { group: "default", points: 1 },
    getPrebuildEvents: { group: "default", points: 1 },
    setUsageAttribution: { group: "default", points: 1 },
    listAvailableUsageAttributionIds: { group: "default", points: 1 },
    getUsageLimit: { group: "default", points: 1 },
    setUsageLimit: { group: "default", points: 1 },
    getNotifications: { group: "default", points: 1 },
    getSupportedWorkspaceClasses: { group: "default", points: 1 },
};

function getConfig(config: RateLimiterConfig): RateLimiterConfig {
    const defaultGroups: GroupsConfig = {
        default: {
            points: 60000, // 1,000 calls per user per second
            durationsSec: 60,
        },
        startWorkspace: {
            points: 3, // 3 workspace starts per user per 10s
            durationsSec: 10,
        },
        createWorkspace: {
            points: 3, // 3 workspace creates per user per 10s
            durationsSec: 10,
        },
        phoneVerification: {
            points: 10,
            durationsSec: 10,
        },
    };

    return {
        groups: { ...defaultGroups, ...config.groups },
        functions: { ...defaultFunctions, ...config.functions },
    };
}

export interface RateLimiter {
    user: string;
    consume(method: string): Promise<RateLimiterRes>;
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
        Object.keys(this.config.groups).forEach((group) => {
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
            log.warn(
                `method '${method}' is configured for a rate limiter '${group}' but this rate limiter does not exist, using 'default' instead`,
            );
        }

        const points = this.config.functions[method as GitpodServerMethodType]?.points || 1;
        return await limiter.consume(user, points);
    }
}
