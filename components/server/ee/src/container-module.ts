/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";
import { GitpodServerImpl } from "../../src/workspace/gitpod-server-impl";
import { GitpodServerEEImpl } from "./workspace/gitpod-server-impl";
import { Server } from "../../src/server";
import { ServerEE } from "./server";
import { HostContainerMapping } from "../../src/auth/host-container-mapping";
import { HostContainerMappingEE } from "./auth/host-container-mapping";
import { PrebuildManager } from "./prebuilds/prebuild-manager";
import { GithubApp } from "./prebuilds/github-app";
import { GithubAppRules } from "./prebuilds/github-app-rules";
import { PrebuildStatusMaintainer } from "./prebuilds/prebuilt-status-maintainer";
import { GitLabApp } from "./prebuilds/gitlab-app";
import { BitbucketApp } from "./prebuilds/bitbucket-app";
import { GitHubEnterpriseApp } from "./prebuilds/github-enterprise-app";
import { IncrementalPrebuildsService } from "./prebuilds/incremental-prebuilds-service";
import { IPrefixContextParser } from "../../src/workspace/context-parser";
import { StartPrebuildContextParser } from "./prebuilds/start-prebuild-context-parser";
import { WorkspaceFactory } from "../../src/workspace/workspace-factory";
import { WorkspaceFactoryEE } from "./workspace/workspace-factory";
import { StripeService } from "./user/stripe-service";
import { BlockedUserFilter } from "../../src/auth/blocked-user-filter";
import { EMailDomainService, EMailDomainServiceImpl } from "./auth/email-domain-service";
import { GitHubAppSupport } from "./github/github-app-support";
import { GitLabAppSupport } from "./gitlab/gitlab-app-support";
import { Config } from "../../src/config";
import { BitbucketAppSupport } from "./bitbucket/bitbucket-app-support";
import { BitbucketServerApp } from "./prebuilds/bitbucket-server-app";
import { EntitlementService } from "../../src/billing/entitlement-service";
import { BillingModes, BillingModesImpl } from "./billing/billing-mode";
import { EntitlementServiceLicense } from "./billing/entitlement-service-license";
import { EntitlementServiceImpl } from "./billing/entitlement-service";
import { EntitlementServiceUBP } from "./billing/entitlement-service-ubp";
import { UsageService, UsageServiceImpl, NoOpUsageService } from "../../src/user/usage-service";

export const productionEEContainerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    rebind(Server).to(ServerEE).inSingletonScope();
    rebind(WorkspaceFactory).to(WorkspaceFactoryEE).inSingletonScope();

    bind(PrebuildManager).toSelf().inSingletonScope();
    bind(IPrefixContextParser).to(StartPrebuildContextParser).inSingletonScope();
    bind(GithubApp).toSelf().inSingletonScope();
    bind(GitHubAppSupport).toSelf().inSingletonScope();
    bind(GithubAppRules).toSelf().inSingletonScope();
    bind(PrebuildStatusMaintainer).toSelf().inSingletonScope();
    bind(GitLabApp).toSelf().inSingletonScope();
    bind(GitLabAppSupport).toSelf().inSingletonScope();
    bind(BitbucketApp).toSelf().inSingletonScope();
    bind(BitbucketAppSupport).toSelf().inSingletonScope();
    bind(GitHubEnterpriseApp).toSelf().inSingletonScope();
    bind(BitbucketServerApp).toSelf().inSingletonScope();
    bind(IncrementalPrebuildsService).toSelf().inSingletonScope();

    // GitpodServerImpl (stateful per user)
    rebind(GitpodServerImpl).to(GitpodServerEEImpl).inRequestScope();

    // various
    rebind(HostContainerMapping).to(HostContainerMappingEE).inSingletonScope();
    bind(EMailDomainService).to(EMailDomainServiceImpl).inSingletonScope();
    rebind(BlockedUserFilter).toService(EMailDomainService);

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
