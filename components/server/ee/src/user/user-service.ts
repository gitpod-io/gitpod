/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { UserService, CheckSignUpParams, CheckTermsParams } from "../../../src/user/user-service";
import { User } from "@gitpod/gitpod-protocol";
import { inject } from "inversify";
import { SubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { HostContextProvider } from "../../../src/auth/host-context-provider";
import { Config } from "../../../src/config";

export class UserServiceEE extends UserService {
    @inject(SubscriptionService) protected readonly subscriptionService: SubscriptionService;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(Config) protected readonly config: Config;

    async checkSignUp(params: CheckSignUpParams) {
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
}
