/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { UserService, CheckSignUpParams, CheckTermsParams } from "../../../src/user/user-service";
import { User } from "@gitpod/gitpod-protocol";
import { inject } from "inversify";
import { LicenseEvaluator } from "@gitpod/licensor/lib";
import { AuthException } from "../../../src/auth/errors";
import { SubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { OssAllowListDB } from "@gitpod/gitpod-db/lib/oss-allowlist-db";
import { HostContextProvider } from "../../../src/auth/host-context-provider";
import { Config } from "../../../src/config";

export class UserServiceEE extends UserService {
    @inject(LicenseEvaluator) protected readonly licenseEvaluator: LicenseEvaluator;
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
    @inject(OssAllowListDB) protected readonly OssAllowListDb: OssAllowListDB;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(Config) protected readonly config: Config;

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
