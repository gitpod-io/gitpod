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
    Workspace,
} from "@gitpod/gitpod-protocol";
import { inject } from "inversify";
import { LicenseEvaluator } from "@gitpod/licensor/lib";
import { AuthException } from "../../../src/auth/errors";
import { SubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { OssAllowListDB } from "@gitpod/gitpod-db/lib/oss-allowlist-db";
import { HostContextProvider } from "../../../src/auth/host-context-provider";
import { Config } from "../../../src/config";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { ResponseError } from "vscode-ws-jsonrpc";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { UsageService } from "../../../src/user/usage-service";

export interface UsageLimitReachedResult {
    reached: boolean;
    almostReached?: boolean;
    attributionId: AttributionId;
}

export class UserServiceEE extends UserService {
    @inject(LicenseEvaluator) protected readonly licenseEvaluator: LicenseEvaluator;
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
    @inject(OssAllowListDB) protected readonly OssAllowListDb: OssAllowListDB;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(Config) protected readonly config: Config;
    @inject(UsageService) protected readonly usageService: UsageService;
    @inject(UsageServiceDefinition.name)
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

    /**
     * Identifies the team or user to which a workspace instance's running time should be attributed to
     * (e.g. for usage analytics or billing purposes).
     *
     *
     * @param user
     * @param projectId
     * @returns The validated AttributionId
     */
    async getWorkspaceUsageAttributionId(user: User, projectId?: string): Promise<AttributionId> {
        // if it's a workspace for a project the user has access to and the costcenter has credits use that
        if (projectId) {
            let attributionId: AttributionId | undefined;
            const project = await this.projectDb.findProjectById(projectId);
            if (project?.teamId) {
                const teams = await this.teamDB.findTeamsByUser(user.id);
                const team = teams.find((t) => t.id === project?.teamId);
                if (team) {
                    attributionId = AttributionId.create(team);
                }
            } else {
                attributionId = AttributionId.create(user);
            }
            if (
                !!attributionId &&
                (await this.hasCredits(attributionId)) &&
                !(await this.isUnbilledTeam(attributionId))
            ) {
                return attributionId;
            }
        }
        if (user.usageAttributionId) {
            // Return the user's explicit attribution ID.
            return await this.validateUsageAttributionId(user, user.usageAttributionId);
        }
        return AttributionId.create(user);
    }

    protected async validateUsageAttributionId(user: User, usageAttributionId: string): Promise<AttributionId> {
        const attribution = AttributionId.parse(usageAttributionId);
        if (!attribution) {
            throw new ResponseError(ErrorCodes.INVALID_COST_CENTER, "The billing team id configured is invalid.");
        }
        if (attribution.kind === "team") {
            const team = await this.teamDB.findTeamById(attribution.teamId);
            if (!team) {
                throw new ResponseError(
                    ErrorCodes.INVALID_COST_CENTER,
                    "The billing team you've selected no longer exists.",
                );
            }
            const members = await this.teamDB.findMembersByTeam(team.id);
            if (!members.find((m) => m.userId === user.id)) {
                throw new ResponseError(
                    ErrorCodes.INVALID_COST_CENTER,
                    "You're no longer a member of the selected billing team.",
                );
            }
            if (await this.isUnbilledTeam(attribution)) {
                throw new ResponseError(
                    ErrorCodes.INVALID_COST_CENTER,
                    "The billing team you've selected does not have billing enabled.",
                );
            }
        }
        if (attribution.kind === "user") {
            if (user.id !== attribution.userId) {
                throw new ResponseError(
                    ErrorCodes.INVALID_COST_CENTER,
                    "You can select either yourself or a team you are a member of",
                );
            }
        }
        const billedAttributionIds = await this.listAvailableUsageAttributionIds(user);
        if (billedAttributionIds.find((id) => AttributionId.equals(id, attribution)) === undefined) {
            throw new ResponseError(
                ErrorCodes.INVALID_COST_CENTER,
                "You can select either yourself or a billed team you are a member of",
            );
        }
        return attribution;
    }

    /**
     * @param user
     * @param workspace - optional, in which case the default billing account will be checked
     * @returns
     */
    async checkUsageLimitReached(user: User, workspace?: Workspace): Promise<UsageLimitReachedResult> {
        const attributionId = await this.getWorkspaceUsageAttributionId(user, workspace?.projectId);
        const creditBalance = await this.usageService.getCurrentBalance(attributionId);
        const currentInvoiceCredits = creditBalance.usedCredits;
        const usageLimit = creditBalance.usageLimit;
        if (currentInvoiceCredits >= usageLimit) {
            log.info({ userId: user.id }, "Usage limit reached", {
                attributionId,
                currentInvoiceCredits,
                usageLimit,
            });
            return {
                reached: true,
                attributionId,
            };
        } else if (currentInvoiceCredits > usageLimit * 0.8) {
            log.info({ userId: user.id }, "Usage limit almost reached", {
                attributionId,
                currentInvoiceCredits,
                usageLimit,
            });
            return {
                reached: false,
                almostReached: true,
                attributionId,
            };
        }

        return {
            reached: false,
            attributionId,
        };
    }

    protected async hasCredits(attributionId: AttributionId): Promise<boolean> {
        const response = await this.usageService.getCurrentBalance(attributionId);
        return response.usedCredits < response.usageLimit;
    }
}
