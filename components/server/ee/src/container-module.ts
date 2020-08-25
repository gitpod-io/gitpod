/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { ContainerModule } from "inversify";
import { GitpodServerImpl } from "../../src/workspace/gitpod-server-impl";
import { GitpodServerEEImpl } from "./workspace/gitpod-server-impl";
import { GraphQLController } from './graphql/graphql-controller';
import { GraphQLResolvers } from './graphql/resolvers';
import { Server } from "../../src/server";
import { ServerEE } from "./server";
import { UserController } from "../../src/user/user-controller";
import { UserControllerEE } from "./user/user-controller";
import { LicenseEvaluator, LicenseKeySource } from "@gitpod/licensor/lib";
import { DBLicenseKeySource } from "./license-source";
import { LicenseDB } from "@gitpod/gitpod-db/lib/license-db";
import { LicenseDBImpl } from "@gitpod/gitpod-db/lib/typeorm/license-db-impl";
import { UserService } from "../../src/user/user-service";
import { UserServiceEE } from "./user/user-service";
import { HostContainerMapping } from "../../src/auth/host-container-mapping";
import { HostContainerMappingEE } from "./auth/host-container-mapping";
import { PrebuildManager } from "./prebuilds/prebuild-manager";
import { PrebuildRateLimiter } from "./prebuilds/prebuild-rate-limiter";
import { PrebuildQueueMaintainer } from "./prebuilds/prebuild-queue-maintainer";
import { GithubApp } from "./prebuilds/github-app";
import { GithubAppRules } from "./prebuilds/github-app-rules";
import { PrebuildStatusMaintainer } from "./prebuilds/prebuilt-status-maintainer";
import { GitLabApp } from "./prebuilds/gitlab-app";
import { BitbucketApp } from "./prebuilds/bitbucket-app";
import { IPrefixContextParser } from "../../src/workspace/context-parser";
import { StartPrebuildContextParser } from "./prebuilds/start-prebuild-context-parser";
import { WorkspaceFactory } from "../../src/workspace/workspace-factory";
import { WorkspaceFactoryEE } from "./workspace/workspace-factory";
import { MonitoringEndpointsAppEE } from "./monitoring-endpoint-ee";
import { MonitoringEndpointsApp } from "../../src/monitoring-endpoints";
import { WorkspaceHealthMonitoring } from "./workspace/workspace-health-monitoring";

export const productionEEContainerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    rebind(Server).to(ServerEE).inSingletonScope();
    rebind(GitpodServerImpl).to(GitpodServerEEImpl).inRequestScope();
    rebind(UserController).to(UserControllerEE).inSingletonScope();
    rebind(UserService).to(UserServiceEE).inSingletonScope();
    rebind(WorkspaceFactory).to(WorkspaceFactoryEE).inSingletonScope();
    rebind(MonitoringEndpointsApp).to(MonitoringEndpointsAppEE).inSingletonScope();

    rebind(HostContainerMapping).to(HostContainerMappingEE).inSingletonScope();

    bind(WorkspaceHealthMonitoring).toSelf().inSingletonScope();
    bind(PrebuildManager).toSelf().inSingletonScope();
    bind(PrebuildRateLimiter).toSelf().inSingletonScope();
    bind(PrebuildQueueMaintainer).toSelf().inSingletonScope();
    bind(IPrefixContextParser).to(StartPrebuildContextParser).inSingletonScope();
    bind(GithubApp).toSelf().inSingletonScope();
    bind(GithubAppRules).toSelf().inSingletonScope();
    bind(PrebuildStatusMaintainer).toSelf().inSingletonScope();
    bind(GitLabApp).toSelf().inSingletonScope();
    bind(BitbucketApp).toSelf().inSingletonScope();

    bind(LicenseEvaluator).toSelf().inSingletonScope();
    bind(LicenseKeySource).to(DBLicenseKeySource).inSingletonScope();
    bind(LicenseDB).to(LicenseDBImpl).inSingletonScope();

    bind(GraphQLController).toSelf().inSingletonScope();
    bind(GraphQLResolvers).toSelf().inSingletonScope();
});