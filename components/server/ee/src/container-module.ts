/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { ContainerModule } from "inversify";
import { GitpodServerImpl } from "../../src/workspace/gitpod-server-impl";
import { GitpodServerEEImpl } from "./workspace/gitpod-server-impl";
import { Server } from "../../src/server";
import { ServerEE } from "./server";
import { UserController } from "../../src/user/user-controller";
import { UserControllerEE } from "./user/user-controller";
import { LicenseEvaluator, LicenseKeySource } from "@gitpod/licensor/lib";
import { DBLicenseKeySource } from "./license-source";
import { UserService } from "../../src/user/user-service";
import { UserServiceEE } from "./user/user-service";
import { HostContainerMapping } from "../../src/auth/host-container-mapping";
import { HostContainerMappingEE } from "./auth/host-container-mapping";
import { PrebuildManager } from "./prebuilds/prebuild-manager";
import { GithubApp } from "./prebuilds/github-app";
import { GithubAppRules } from "./prebuilds/github-app-rules";
import { PrebuildStatusMaintainer } from "./prebuilds/prebuilt-status-maintainer";
import { GitLabApp } from "./prebuilds/gitlab-app";
import { BitbucketApp } from "./prebuilds/bitbucket-app";
import { GitHubEnterpriseApp } from "./prebuilds/github-enterprise-app";
import { IPrefixContextParser } from "../../src/workspace/context-parser";
import { StartPrebuildContextParser } from "./prebuilds/start-prebuild-context-parser";
import { StartIncrementalPrebuildContextParser } from "./prebuilds/start-incremental-prebuild-context-parser";
import { IWorkspaceFactory } from "../../src/workspace/workspace-factory";
import { WorkspaceFactoryEE } from "./workspace/workspace-factory";
import { MonitoringEndpointsAppEE } from "./monitoring-endpoint-ee";
import { MonitoringEndpointsApp } from "../../src/monitoring-endpoints";
import { WorkspaceHealthMonitoring } from "./workspace/workspace-health-monitoring";
import { AccountService } from "@gitpod/gitpod-payment-endpoint/lib/accounting/account-service";
import { AccountServiceImpl, SubscriptionService, TeamSubscriptionService } from "@gitpod/gitpod-payment-endpoint/lib/accounting";
import { ChargebeeProvider, ChargebeeProviderOptions, UpgradeHelper } from "@gitpod/gitpod-payment-endpoint/lib/chargebee";
import { ChargebeeCouponComputer } from "./user/coupon-computer";
import { ChargebeeService } from "./user/chargebee-service";
import { EligibilityService } from "./user/eligibility-service";
import { AccountStatementProvider } from "./user/account-statement-provider";
import { WorkspaceStarterEE } from "./workspace/workspace-starter";
import { WorkspaceStarter } from "../../src/workspace/workspace-starter";
import { UserDeletionService } from "../../src/user/user-deletion-service";
import { BlockedUserFilter } from "../../src/auth/blocked-user-filter";
import { EMailDomainService, EMailDomainServiceImpl } from "./auth/email-domain-service";
import { UserDeletionServiceEE } from "./user/user-deletion-service";
import { GitHubAppSupport } from "./github/github-app-support";
import { GitLabAppSupport } from "./gitlab/gitlab-app-support";
import { Config } from "../../src/config";
import { SnapshotService } from "./workspace/snapshot-service";
import { BitbucketAppSupport } from "./bitbucket/bitbucket-app-support";

export const productionEEContainerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(WorkspaceFactoryEE).to(WorkspaceFactoryEE).inSingletonScope()

    rebind(Server).to(ServerEE).inSingletonScope();
    rebind(UserService).to(UserServiceEE).inSingletonScope();
    rebind(IWorkspaceFactory).to(WorkspaceFactoryEE).inSingletonScope();
    rebind(MonitoringEndpointsApp).to(MonitoringEndpointsAppEE).inSingletonScope();

    bind(WorkspaceHealthMonitoring).toSelf().inSingletonScope();
    bind(PrebuildManager).toSelf().inSingletonScope();
    bind(IPrefixContextParser).to(StartPrebuildContextParser).inSingletonScope();
    bind(IPrefixContextParser).to(StartIncrementalPrebuildContextParser).inSingletonScope();
    bind(GithubApp).toSelf().inSingletonScope();
    bind(GitHubAppSupport).toSelf().inSingletonScope();
    bind(GithubAppRules).toSelf().inSingletonScope();
    bind(PrebuildStatusMaintainer).toSelf().inSingletonScope();
    bind(GitLabApp).toSelf().inSingletonScope();
    bind(GitLabAppSupport).toSelf().inSingletonScope();
    bind(BitbucketApp).toSelf().inSingletonScope();
    bind(BitbucketAppSupport).toSelf().inSingletonScope();
    bind(GitHubEnterpriseApp).toSelf().inSingletonScope();

    bind(LicenseEvaluator).toSelf().inSingletonScope();
    bind(LicenseKeySource).to(DBLicenseKeySource).inSingletonScope();

    // GitpodServerImpl (stateful per user)
    rebind(GitpodServerImpl).to(GitpodServerEEImpl).inRequestScope();
    bind(EligibilityService).toSelf().inRequestScope();
    bind(AccountStatementProvider).toSelf().inRequestScope();

    // various
    rebind(HostContainerMapping).to(HostContainerMappingEE).inSingletonScope();
    bind(EMailDomainService).to(EMailDomainServiceImpl).inSingletonScope();
    rebind(BlockedUserFilter).toService(EMailDomainService);
    rebind(UserController).to(UserControllerEE).inSingletonScope();
    bind(SnapshotService).toSelf().inSingletonScope();

    bind(UserDeletionServiceEE).toSelf().inSingletonScope();
    rebind(UserDeletionService).to(UserDeletionServiceEE).inSingletonScope();

    // workspace management
    rebind(WorkspaceStarter).to(WorkspaceStarterEE).inSingletonScope();

    // acounting
    bind(AccountService).to(AccountServiceImpl).inSingletonScope();
    bind(SubscriptionService).toSelf().inSingletonScope();
    bind(TeamSubscriptionService).toSelf().inSingletonScope();

    // payment/billing
    bind(ChargebeeProvider).toSelf().inSingletonScope();
    bind(ChargebeeProviderOptions).toDynamicValue(ctx => {
        const config = ctx.container.get<Config>(Config);
        return config.chargebeeProviderOptions;
    }).inSingletonScope();
    bind(UpgradeHelper).toSelf().inSingletonScope();
    bind(ChargebeeCouponComputer).toSelf().inSingletonScope();
    bind(ChargebeeService).toSelf().inSingletonScope();
});
