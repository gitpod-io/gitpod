/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { UserService, CheckSignUpParams, CheckTermsParams } from "../../../src/user/user-service";
import {
    User,
    WorkspaceTimeoutDuration,
    WORKSPACE_TIMEOUT_EXTENDED,
    WORKSPACE_TIMEOUT_EXTENDED_ALT,
    WORKSPACE_TIMEOUT_DEFAULT_LONG,
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
    Project,
} from "@gitpod/gitpod-protocol";
import { inject } from "inversify";
import { LicenseEvaluator } from "@gitpod/licensor/lib";
import { Feature } from "@gitpod/licensor/lib/api";
import { AuthException } from "../../../src/auth/errors";
import { EligibilityService } from "./eligibility-service";
import { SubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { OssAllowListDB } from "@gitpod/gitpod-db/lib/oss-allowlist-db";
import { HostContextProvider } from "../../../src/auth/host-context-provider";
import { Config } from "../../../src/config";
import { TeamDB } from "@gitpod/gitpod-db/lib";
import { StripeService } from "./stripe-service";

export class UserServiceEE extends UserService {
    @inject(LicenseEvaluator) protected readonly licenseEvaluator: LicenseEvaluator;
    @inject(EligibilityService) protected readonly eligibilityService: EligibilityService;
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
    @inject(OssAllowListDB) protected readonly OssAllowListDb: OssAllowListDB;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(Config) protected readonly config: Config;
    @inject(TeamDB) protected readonly teamDb: TeamDB;
    @inject(StripeService) protected readonly stripeService: StripeService;

    async getDefaultWorkspaceTimeout(user: User, date: Date): Promise<WorkspaceTimeoutDuration> {
        if (this.config.enablePayment) {
            // the SaaS case
            return this.eligibilityService.getDefaultWorkspaceTimeout(user, date);
        }

        const userCount = await this.userDb.getUserCount(true);

        // the self-hosted case
        if (!this.licenseEvaluator.isEnabled(Feature.FeatureSetTimeout, userCount)) {
            return WORKSPACE_TIMEOUT_DEFAULT_SHORT;
        }

        return WORKSPACE_TIMEOUT_DEFAULT_LONG;
    }

    public workspaceTimeoutToDuration(timeout: WorkspaceTimeoutDuration): string {
        switch (timeout) {
            case WORKSPACE_TIMEOUT_DEFAULT_SHORT:
                return "30m";
            case WORKSPACE_TIMEOUT_DEFAULT_LONG:
                return this.config.workspaceDefaults.timeoutDefault || "60m";
            case WORKSPACE_TIMEOUT_EXTENDED:
            case WORKSPACE_TIMEOUT_EXTENDED_ALT:
                return this.config.workspaceDefaults.timeoutExtended || "180m";
        }
    }

    public durationToWorkspaceTimeout(duration: string): WorkspaceTimeoutDuration {
        switch (duration) {
            case "30m":
                return WORKSPACE_TIMEOUT_DEFAULT_SHORT;
            case this.config.workspaceDefaults.timeoutDefault || "60m":
                return WORKSPACE_TIMEOUT_DEFAULT_LONG;
            case this.config.workspaceDefaults.timeoutExtended || "180m":
                return WORKSPACE_TIMEOUT_EXTENDED_ALT;
            default:
                return WORKSPACE_TIMEOUT_DEFAULT_SHORT;
        }
    }

    async userGetsMoreResources(user: User): Promise<boolean> {
        if (this.config.enablePayment) {
            return this.eligibilityService.userGetsMoreResources(user);
        }

        return false;
    }

    async getWorkspaceUsageAttributionTeamId(user: User, projectId?: string): Promise<string | undefined> {
        let project: Project | undefined;
        if (projectId) {
            project = await this.projectDb.findProjectById(projectId);
        }
        if (!this.config.enablePayment) {
            // If the project is owned by a team, we attribute workspace usage to that team.
            // Otherwise, we return `undefined` to attribute to the user (default).
            return project?.teamId;
        }
        // If payment is enabled, we attribute workspace usage to a team that has billing enabled.
        const teams = await this.teamDb.findTeamsByUser(user.id);
        const customers = await this.stripeService.findCustomersByTeamIds(teams.map((t) => t.id));
        if (customers.length === 0) {
            // No teams with billing enabled, fall back to user attribution.
            return undefined;
        }
        // TODO(janx): Allow users to pick a "cost center" team, and use it here.

        // If there are multiple teams with billing enabled, we prefer the one owning the project if possible.
        if (project?.teamId && customers.find((c) => c.metadata.teamId === project!.teamId)) {
            return project.teamId;
        }
        // Otherwise, we just pick the first team with billing enabled.
        return customers[0].metadata.teamId;
    }

    async checkSignUp(params: CheckSignUpParams) {
        // todo@at: check if we need an optimization for SaaS here. used to be a no-op there.

        // 1. check the license
        const userCount = await this.userDb.getUserCount(true);
        if (!this.licenseEvaluator.hasEnoughSeats(userCount)) {
            const msg = `Maximum number of users permitted by the license exceeded`;
            throw AuthException.create("Cannot sign up", msg, { userCount, params });
        }

        // 2. check defaults
        await super.checkSignUp(params);
    }

    async checkTermsAcceptanceRequired(params: CheckTermsParams): Promise<boolean> {
        ///////////////////////////////////////////////////////////////////////////
        // Currently, we don't check for ToS on login.
        ///////////////////////////////////////////////////////////////////////////

        return false;
    }

    async checkTermsAccepted(user: User) {
        // called from GitpodServer implementation

        ///////////////////////////////////////////////////////////////////////////
        // Currently, we don't check for ToS on Gitpod API calls.
        ///////////////////////////////////////////////////////////////////////////

        return true;
    }

    async checkAutomaticOssEligibility(user: User): Promise<boolean> {
        const idsWithHost = user.identities
            .map((id) => {
                const hostContext = this.hostContextProvider.findByAuthProviderId(id.authProviderId);
                if (!hostContext) {
                    return undefined;
                }
                const info = hostContext.authProvider.info;
                return `${info.host}/${id.authName}`;
            })
            .filter((i) => !!i) as string[];

        return this.OssAllowListDb.hasAny(idsWithHost);
    }
}
