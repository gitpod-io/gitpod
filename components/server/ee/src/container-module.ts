/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";
import { GitpodServerImpl } from "../../src/workspace/gitpod-server-impl";
import { GitpodServerEEImpl } from "./workspace/gitpod-server-impl";
import { StripeService } from "./user/stripe-service";
import { Config } from "../../src/config";
import { EntitlementService } from "../../src/billing/entitlement-service";
import { BillingModes, BillingModesImpl } from "./billing/billing-mode";
import { EntitlementServiceLicense } from "./billing/entitlement-service-license";
import { EntitlementServiceImpl } from "./billing/entitlement-service";
import { EntitlementServiceUBP } from "./billing/entitlement-service-ubp";
import { UsageService, UsageServiceImpl, NoOpUsageService } from "../../src/user/usage-service";

export const productionEEContainerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    // GitpodServerImpl (stateful per user)
    rebind(GitpodServerImpl).to(GitpodServerEEImpl).inRequestScope();

    // payment/billing
    bind(StripeService).toSelf().inSingletonScope();

    bind(EntitlementServiceLicense).toSelf().inSingletonScope();
    bind(EntitlementServiceUBP).toSelf().inSingletonScope();
    bind(EntitlementServiceImpl).toSelf().inSingletonScope();
    rebind(EntitlementService).to(EntitlementServiceImpl).inSingletonScope();
    bind(BillingModes).to(BillingModesImpl).inSingletonScope();

    // TODO(gpl) Remove as part of fixing https://github.com/gitpod-io/gitpod/issues/14129
    rebind(UsageService)
        .toDynamicValue((ctx) => {
            const config = ctx.container.get<Config>(Config);
            if (config.enablePayment) {
                return ctx.container.get<UsageServiceImpl>(UsageServiceImpl);
            }
            return new NoOpUsageService();
        })
        .inSingletonScope();
});
