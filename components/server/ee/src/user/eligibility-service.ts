/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { TeamDB, TeamSubscription2DB, TeamSubscriptionDB, UserDB } from "@gitpod/gitpod-db/lib";
import { TokenProvider } from "../../../src/user/token-provider";
import { User } from "@gitpod/gitpod-protocol";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { SubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { AccountStatementProvider } from "./account-statement-provider";
import { EMailDomainService } from "../auth/email-domain-service";
import fetch from "node-fetch";
import { Config } from "../../../src/config";

/**
 * Response from the GitHub Education Student Developer / Faculty Member Pack.
 * The flags `student` and `faculty` are mutually exclusive (the cannot both become `true`).
 *
 * https://education.github.com/pack
 *
 */
export interface GitHubEducationPack {
    student: boolean;
    faculty: boolean;
}

@injectable()
export class EligibilityService {
    @inject(Config) protected readonly config: Config;
    @inject(UserDB) protected readonly userDb: UserDB;
    @inject(TeamDB) protected readonly teamDb: TeamDB;
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
    @inject(EMailDomainService) protected readonly domainService: EMailDomainService;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(AccountStatementProvider) protected readonly accountStatementProvider: AccountStatementProvider;
    @inject(TeamSubscriptionDB) protected readonly teamSubscriptionDb: TeamSubscriptionDB;
    @inject(TeamSubscription2DB) protected readonly teamSubscription2Db: TeamSubscription2DB;

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
            token = (await this.tokenProvider.getTokenForHost(user, "github.com")).value;
        } catch (err) {
            // user has no GitHub token, thus cannot have the student/faculty pack
            return { student: false, faculty: false };
        }

        const logCtx = { userId: user.id };
        try {
            const rawResponse = await fetch("https://education.github.com/api/user", {
                timeout: 5000,
                headers: {
                    Authorization: `token ${token}`,
                    "faculty-check-preview": "true",
                },
            });
            if (!rawResponse.ok) {
                log.warn(
                    logCtx,
                    `fetching the GitHub Education API failed with status ${rawResponse.status}: ${rawResponse.statusText}`,
                );
                return { student: false, faculty: false };
            }
            const result: GitHubEducationPack = await rawResponse.json();
            if (result.student && result.faculty) {
                // That violates the API contract: `student` and `faculty` need to be mutually exclusive
                log.warn(
                    logCtx,
                    "result of GitHub Eduction API violates the API contract: student and faculty need to be mutually exclusive",
                    result,
                );
                return { student: false, faculty: false };
            }
            return result;
        } catch (err) {
            log.warn(logCtx, "error while checking student pack status", err);
        }
        return { student: false, faculty: false };
    }

    protected async getUser(user: User | string): Promise<User> {
        if (typeof user === "string") {
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
