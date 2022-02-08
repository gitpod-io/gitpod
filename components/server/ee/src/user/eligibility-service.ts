/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { inject, injectable } from "inversify";
import { UserDB } from "@gitpod/gitpod-db/lib";
import { HostContextProvider } from "../../../src/auth/host-context-provider";
import { TokenProvider } from "../../../src/user/token-provider";
import { User, WorkspaceTimeoutDuration, WorkspaceInstance } from "@gitpod/gitpod-protocol";
import { RemainingHours } from "@gitpod/gitpod-protocol/lib/accounting-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Plans, MAX_PARALLEL_WORKSPACES } from "@gitpod/gitpod-protocol/lib/plans";
import { Accounting, SubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { millisecondsToHours} from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { AccountStatementProvider, CachedAccountStatement } from "./account-statement-provider";
import { EMailDomainService } from "../auth/email-domain-service";
import fetch from "node-fetch";
import { Config } from "../../../src/config";

export interface MayStartWorkspaceResult {
    hitParallelWorkspaceLimit?: HitParallelWorkspaceLimit;
    enoughCredits: boolean;
}

export interface HitParallelWorkspaceLimit {
    max: number;
    current: number;
}

/**
 * Response from the GitHub Education Student Developer / Faculty Member Pack.
 * The flags `student` and `faculty` are mutually exclusive (the cannot both become `true`).
 *
 * https://education.github.com/pack
 *
 */
export interface GitHubEducationPack {
    student: boolean
    faculty: boolean
}

@injectable()
export class EligibilityService {

    @inject(Config) protected readonly config: Config;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(EMailDomainService) protected readonly domainService: EMailDomainService;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(AccountStatementProvider) protected readonly accountStatementProvider: AccountStatementProvider;

    /**
     * Whether the given user is recognized as a student within Gitpod
     * @param user
     */
    async isStudent(user: User | string): Promise<boolean> {
        user = await this.getUser(user);

        // check if any of the user's emails is from a known university
        for (const identity of user.identities) {
            if (!identity.primaryEmail) {
                continue;
            }

            const emailSuffixMatches = await this.domainService.hasEducationalInstitutionSuffix(identity.primaryEmail);
            if (emailSuffixMatches) {
                return true;
            }
        }

        // the users primary email did not match a known university - maybe they're a GitHub student pack member.
        const { student } = await this.getGitHubEducationPack(user);
        if (student) {
            return true;
        }

        return false;
    }

    /**
     * Whether the given user is subscribed to the GitHub student/faculty pack.
     * https://education.github.com/pack
     */
    async getGitHubEducationPack(user: User): Promise<GitHubEducationPack> {
        let token: string;
        try {
            token = (await this.tokenProvider.getTokenForHost(user, "github.com")).value
        } catch (err) {
            // user has no GitHub token, thus cannot have the student/faculty pack
            return { student: false, faculty: false };
        }

        const logCtx = { userId: user.id };
        try {
            const rawResponse = await fetch("https://education.github.com/api/user", {
                headers: {
                    "Authorization": `token ${token}`,
                    "faculty-check-preview": "true"
                }
            });
            if (!rawResponse.ok) {
                log.warn(logCtx, `fetching the GitHub Education API failed with status ${rawResponse.status}: ${rawResponse.statusText}`);
            }
            const result : GitHubEducationPack = JSON.parse(await rawResponse.text());
            if(result.student && result.faculty) {
                // That violates the API contract: `student` and `faculty` need to be mutually exclusive
                log.warn(logCtx, "result of GitHub Eduction API violates the API contract: student and faculty need to be mutually exclusive", result);
                return { student: false, faculty: false };
            }
            return result;
        } catch (err) {
            log.warn(logCtx, "error while checking student pack status", err);
        }
        return { student: false, faculty: false };
    }

    /**
     * Whether a user is allowed to start a workspace
     * !!! This is executed on the hot path of workspace startup, be careful with async when changing !!!
     * @param user
     * @param date now
     * @param runningInstances
     */
    async mayStartWorkspace(user: User, date: Date, runningInstances: Promise<WorkspaceInstance[]>): Promise<MayStartWorkspaceResult> {
        if (!this.config.enablePayment) {
            return { enoughCredits: true };
        }

        const hasHitParallelWorkspaceLimit = async (): Promise<HitParallelWorkspaceLimit | undefined> => {
            const max = await this.getMaxParallelWorkspaces(user);
            const instances = (await runningInstances).filter(i => i.status.phase !== "unknown");
            const current = instances.length;   // >= parallelWorkspaceAllowance;
            if (current >= max) {
                return {
                    current,
                    max
                };
            } else {
                return undefined;
            }
        };
        const [enoughCredits, hitParallelWorkspaceLimit] = await Promise.all([
            this.checkEnoughCreditForWorkspaceStart(user.id, date, runningInstances),
            hasHitParallelWorkspaceLimit()
        ]);

        return {
            enoughCredits: !!enoughCredits,
            hitParallelWorkspaceLimit
        };
    }

    /**
     * Returns the maximum number of parallel workspaces a user can run at the same time.
     * @param user
     * @param date The date for which we want to know whether the user is allowed to set a timeout (depends on active subscription)
     */
    protected async getMaxParallelWorkspaces(user: User, date: Date = new Date()): Promise<number> {
        // if payment is not enabled users can start as many parallel workspaces as they want
        if (!this.config.enablePayment) {
            return MAX_PARALLEL_WORKSPACES;
        }

        const subscriptions = await this.subscriptionService.getNotYetCancelledSubscriptions(user, date.toISOString());
        return subscriptions.map(s => Plans.getParallelWorkspacesById(s.planId)).reduce((p, v) => Math.max(p, v));
    }

    protected async checkEnoughCreditForWorkspaceStart(userId: string, date: Date, runningInstances: Promise<WorkspaceInstance[]>): Promise<boolean> {
        // As retrieving a full AccountStatement is expensive we want to cache it as much as possible.
        const cachedAccountStatement = this.accountStatementProvider.getCachedStatement();
        const lowerBound = this.getRemainingUsageHoursLowerBound(cachedAccountStatement, date.toISOString());
        if (lowerBound && (lowerBound === 'unlimited' || lowerBound > Accounting.MINIMUM_CREDIT_FOR_OPEN_IN_HOURS)) {
            return true;
        }

        const remainingUsageHours = await this.accountStatementProvider.getRemainingUsageHours(userId, date.toISOString(), runningInstances)
        return remainingUsageHours > Accounting.MINIMUM_CREDIT_FOR_OPEN_IN_HOURS;
    }

    /**
     * Tries to calculate the lower bound of remaining usage hours based on cached AccountStatements
     * with the goal to improve workspace startup times.
     */
    protected getRemainingUsageHoursLowerBound(cachedStatement: CachedAccountStatement | undefined, date: string): RemainingHours | undefined {
        if (!cachedStatement) {
            return undefined;
        }
        if (cachedStatement.remainingHours === 'unlimited') {
            return 'unlimited';
        }

        const diffInMillis = new Date(cachedStatement.endDate).getTime() - new Date(date).getTime();
        const maxPossibleUsage = millisecondsToHours(diffInMillis) * MAX_PARALLEL_WORKSPACES;
        return cachedStatement.remainingHours - maxPossibleUsage;
    }

    /**
     * A user may set the workspace timeout if they have a professional subscription
     * @param user
     * @param date The date for which we want to know whether the user is allowed to set a timeout (depends on active subscription)
     */
    async maySetTimeout(user: User, date: Date = new Date()): Promise<boolean> {
        if (!this.config.enablePayment) {
            // when payment is disabled users can do everything
            return true;
        }

        const subscriptions = await this.subscriptionService.getNotYetCancelledSubscriptions(user, date.toISOString());
        const eligblePlans = [
            Plans.PROFESSIONAL_EUR,
            Plans.PROFESSIONAL_USD,
            Plans.PROFESSIONAL_STUDENT_EUR,
            Plans.PROFESSIONAL_STUDENT_USD,
            Plans.TEAM_PROFESSIONAL_EUR,
            Plans.TEAM_PROFESSIONAL_USD,
            Plans.TEAM_PROFESSIONAL_STUDENT_EUR,
            Plans.TEAM_PROFESSIONAL_STUDENT_USD,
        ].map(p => p.chargebeeId);

        return subscriptions.filter(s => eligblePlans.includes(s.planId!)).length > 0;
    }

    /**
     * Returns the default workspace timeout for the given user at a given point in time
     * @param user
     * @param date The date for which we want to know the default workspace timeout (depends on active subscription)
     */
    async getDefaultWorkspaceTimeout(user: User, date: Date = new Date()): Promise<WorkspaceTimeoutDuration> {
        if (await this.maySetTimeout(user, date)) {
            return "60m";
        } else {
            return "30m";
        }
    }

    /**
     * Returns true if the user is never subject to CPU limiting
     */
    async hasFixedWorkspaceResources(user: User, date: Date = new Date()): Promise<boolean> {
        const subscriptions = await this.subscriptionService.getNotYetCancelledSubscriptions(user, date.toISOString());
        const eligblePlans = [
            Plans.PROFESSIONAL_EUR,
            Plans.PROFESSIONAL_USD,
            Plans.TEAM_PROFESSIONAL_EUR,
            Plans.TEAM_PROFESSIONAL_USD,
        ].map(p => p.chargebeeId);

        return subscriptions.filter(s => eligblePlans.includes(s.planId!)).length > 0;
    }

    /**
     * Returns true if the user ought to land on a workspace cluster that provides more resources
     * compared to the default case.
     */
    async userGetsMoreResources(user: User): Promise<boolean> {
        if (!this.config.enablePayment) {
            // when payment is disabled users can do everything
            return true;
        }

        const subscriptions = await this.subscriptionService.getNotYetCancelledSubscriptions(user, new Date().toISOString());
        const eligblePlans = [
            Plans.PROFESSIONAL_EUR,
            Plans.PROFESSIONAL_USD,
            Plans.TEAM_PROFESSIONAL_EUR,
            Plans.TEAM_PROFESSIONAL_USD,
        ].map(p => p.chargebeeId);

        return subscriptions.filter(s => eligblePlans.includes(s.planId!)).length > 0;
    }

    protected async getUser(user: User | string): Promise<User> {
        if (typeof user === 'string') {
            const realUser = await this.userDb.findUserById(user);
            if (!realUser) {
                throw new Error(`No User found for id ${user}!`);
            }
            return realUser;
        } else {
            return user;
        }
    }

}
