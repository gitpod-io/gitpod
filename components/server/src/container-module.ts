/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";

import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { GitpodFileParser } from "@gitpod/gitpod-protocol/lib/gitpod-file-parser";
import { PrometheusClientCallMetrics } from "@gitpod/gitpod-protocol/lib/messaging/client-call-metrics";
import { newAnalyticsWriterFromEnv } from "@gitpod/gitpod-protocol/lib/util/analytics";
import { DebugApp } from "@gitpod/gitpod-protocol/lib/util/debug-app";
import { IClientCallMetrics, defaultGRPCOptions } from "@gitpod/gitpod-protocol/lib/util/grpc";
import { prometheusClientMiddleware } from "@gitpod/gitpod-protocol/lib/util/nice-grpc";
import { IDEServiceClient, IDEServiceDefinition } from "@gitpod/ide-service-api/lib/ide.pb";
import { ImageBuilderClientCallMetrics, ImageBuilderClientProvider } from "@gitpod/image-builder/lib";
import { BillingServiceClient, BillingServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/billing.pb";
import { UsageServiceClient, UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import {
    IWorkspaceManagerClientCallMetrics,
    WorkspaceManagerClientProvider,
} from "@gitpod/ws-manager/lib/client-provider";
import {
    WorkspaceManagerClientProviderCompositeSource,
    WorkspaceManagerClientProviderDBSource,
    WorkspaceManagerClientProviderEnvSource,
    WorkspaceManagerClientProviderSource,
} from "@gitpod/ws-manager/lib/client-provider-source";
import * as grpc from "@grpc/grpc-js";
import { createChannel, createClient, createClientFactory } from "nice-grpc";
import { retryMiddleware } from "nice-grpc-client-middleware-retry";
import { API } from "./api/server";
import { APIStatsService } from "./api/stats";
import { APITeamsService } from "./api/teams";
import { APIUserService } from "./api/user";
import { APIWorkspacesService } from "./api/workspaces";
import { AuthProviderParams } from "./auth/auth-provider";
import { AuthProviderService } from "./auth/auth-provider-service";
import { Authenticator } from "./auth/authenticator";
import { BearerAuth } from "./auth/bearer-authenticator";
import { HostContainerMapping } from "./auth/host-container-mapping";
import { HostContextProvider, HostContextProviderFactory } from "./auth/host-context-provider";
import { HostContextProviderImpl } from "./auth/host-context-provider-impl";
import { AuthJWT, SignInJWT } from "./auth/jwt";
import { LoginCompletionHandler } from "./auth/login-completion-handler";
import { VerificationService } from "./auth/verification-service";
import { Authorizer, createInitializingAuthorizer } from "./authorization/authorizer";
import { SpiceDBClientProvider, spiceDBConfigFromEnv } from "./authorization/spicedb";
import { BillingModes } from "./billing/billing-mode";
import { EntitlementService, EntitlementServiceImpl } from "./billing/entitlement-service";
import { EntitlementServiceUBP } from "./billing/entitlement-service-ubp";
import { BitbucketAppSupport } from "./bitbucket/bitbucket-app-support";
import { CodeSyncService } from "./code-sync/code-sync-service";
import { Config, ConfigFile } from "./config";
import { ConfigurationService } from "./config/configuration-service";
import { GitHubAppSupport } from "./github/github-app-support";
import { GitLabAppSupport } from "./gitlab/gitlab-app-support";
import { IamSessionApp } from "./iam/iam-session-app";
import { IDEService } from "./ide-service";
import { DatabaseGarbageCollector } from "./jobs/database-gc";
import { OTSGarbageCollector } from "./jobs/ots-gc";
import { JobRunner } from "./jobs/runner";
import { SnapshotsJob } from "./jobs/snapshots";
import { TokenGarbageCollector } from "./jobs/token-gc";
import { WebhookEventGarbageCollector } from "./jobs/webhook-gc";
import { WorkspaceGarbageCollector } from "./jobs/workspace-gc";
import { LinkedInService } from "./linkedin-service";
import { LivenessController } from "./liveness/liveness-controller";
import { MonitoringEndpointsApp } from "./monitoring-endpoints";
import { OAuthController } from "./oauth-server/oauth-controller";
import { OneTimeSecretServer } from "./one-time-secret-server";
import { BitbucketApp } from "./prebuilds/bitbucket-app";
import { BitbucketServerApp } from "./prebuilds/bitbucket-server-app";
import { GithubApp } from "./prebuilds/github-app";
import { GithubAppRules } from "./prebuilds/github-app-rules";
import { GitHubEnterpriseApp } from "./prebuilds/github-enterprise-app";
import { GitLabApp } from "./prebuilds/gitlab-app";
import { IncrementalPrebuildsService } from "./prebuilds/incremental-prebuilds-service";
import { PrebuildManager } from "./prebuilds/prebuild-manager";
import { PrebuildStatusMaintainer } from "./prebuilds/prebuilt-status-maintainer";
import { StartPrebuildContextParser } from "./prebuilds/start-prebuild-context-parser";
import { ProjectsService } from "./projects/projects-service";
import { RedisMutex } from "./redis/mutex";
import { Server } from "./server";
import { SessionHandler } from "./session-handler";
import { ContentServiceStorageClient } from "./storage/content-service-client";
import { StorageClient } from "./storage/storage-client";
import { AuthorizationService, AuthorizationServiceImpl } from "./user/authorization-service";
import { NewsletterSubscriptionController } from "./user/newsletter-subscription-controller";
import { StripeService } from "./billing/stripe-service";
import { TokenProvider } from "./user/token-provider";
import { TokenService } from "./user/token-service";
import { UsageService } from "./orgs/usage-service";
import { ServerFactory, UserController } from "./user/user-controller";
import { UserDeletionService } from "./user/user-deletion-service";
import { UserAuthentication } from "./user/user-authentication";
import { contentServiceBinder } from "./util/content-service-sugar";
import { WebsocketConnectionManager } from "./websocket/websocket-connection-manager";
import { ConfigProvider } from "./workspace/config-provider";
import { IContextParser, IPrefixContextParser } from "./workspace/context-parser";
import { ContextParser } from "./workspace/context-parser-service";
import { EnvvarPrefixParser } from "./workspace/envvar-prefix-context-parser";
import { GitTokenScopeGuesser } from "./workspace/git-token-scope-guesser";
import { GitTokenValidator } from "./workspace/git-token-validator";
import { GitpodServerImpl } from "./workspace/gitpod-server-impl";
import { HeadlessLogController } from "./workspace/headless-log-controller";
import { HeadlessLogService } from "./workspace/headless-log-service";
import { ImageSourceProvider } from "./workspace/image-source-provider";
import { ImageBuildPrefixContextParser } from "./workspace/imagebuild-prefix-context-parser";
import { OpenPrebuildPrefixContextParser } from "./workspace/open-prebuild-prefix-context-parser";
import { ReferrerPrefixParser } from "./workspace/referrer-prefix-context-parser";
import { SnapshotContextParser } from "./workspace/snapshot-context-parser";
import { SnapshotService } from "./workspace/snapshot-service";
import { WorkspaceClusterImagebuilderClientProvider } from "./workspace/workspace-cluster-imagebuilder-client-provider";
import { WorkspaceDownloadService } from "./workspace/workspace-download-service";
import { WorkspaceFactory } from "./workspace/workspace-factory";
import { WorkspaceStarter } from "./workspace/workspace-starter";
import { SpiceDBAuthorizer } from "./authorization/spicedb-authorizer";
import { OrganizationService } from "./orgs/organization-service";
import { RedisSubscriber } from "./messaging/redis-subscriber";
import { Redis } from "ioredis";
import { RedisPublisher, newRedisClient } from "@gitpod/gitpod-db/lib";
import { UserService } from "./user/user-service";
import { RelationshipUpdater } from "./authorization/relationship-updater";
import { WorkspaceService } from "./workspace/workspace-service";
import { SSHKeyService } from "./user/sshkey-service";
import { GitpodTokenService } from "./user/gitpod-token-service";
import { EnvVarService } from "./user/env-var-service";
import { ScmService } from "./projects/scm-service";

export const productionContainerModule = new ContainerModule(
    (bind, unbind, isBound, rebind, unbindAsync, onActivation, onDeactivation) => {
        // gpl: Making this dynamic enables re-use insides tests
        bind(Config)
            .toDynamicValue((ctx) => ConfigFile.fromFile())
            .inSingletonScope();
        bind(IDEService).toSelf().inSingletonScope();

        bind(UserAuthentication).toSelf().inSingletonScope();
        bind(UserService).toSelf().inSingletonScope();
        bind(UserDeletionService).toSelf().inSingletonScope();
        bind(AuthorizationService).to(AuthorizationServiceImpl).inSingletonScope();

        bind(SSHKeyService).toSelf().inSingletonScope();
        bind(GitpodTokenService).toSelf().inSingletonScope();
        bind(EnvVarService).toSelf().inSingletonScope();

        bind(TokenService).toSelf().inSingletonScope();
        bind(TokenProvider).toService(TokenService);

        bind(Authenticator).toSelf().inSingletonScope();
        bind(LoginCompletionHandler).toSelf().inSingletonScope();

        bind(SessionHandler).toSelf().inSingletonScope();
        bind(Server).toSelf().inSingletonScope();
        bind(DebugApp).toSelf().inSingletonScope();

        bind(GitpodFileParser).toSelf().inSingletonScope();

        bind(ConfigProvider).toSelf().inSingletonScope();
        bind(ConfigurationService).toSelf().inSingletonScope();

        bind(SnapshotService).toSelf().inSingletonScope();
        bind(WorkspaceService).toSelf().inSingletonScope();
        bind(WorkspaceFactory).toSelf().inSingletonScope();
        bind(WorkspaceStarter).toSelf().inSingletonScope();
        bind(ImageSourceProvider).toSelf().inSingletonScope();

        bind(ServerFactory).toAutoFactory(GitpodServerImpl);
        bind(UserController).toSelf().inSingletonScope();

        bind(GitpodServerImpl).toSelf();
        bind(WebsocketConnectionManager)
            .toDynamicValue((ctx) => {
                const serverFactory = () => ctx.container.get<GitpodServerImpl>(GitpodServerImpl);
                const hostContextProvider = ctx.container.get<HostContextProvider>(HostContextProvider);
                const config = ctx.container.get<Config>(Config);
                return new WebsocketConnectionManager(serverFactory, hostContextProvider, config.rateLimiter);
            })
            .inSingletonScope();

        bind(PrometheusClientCallMetrics)
            .toSelf()
            .inSingletonScope()
            .onDeactivation((metrics) => metrics.dispose());
        bind(IClientCallMetrics).toService(PrometheusClientCallMetrics);

        bind(WorkspaceClusterImagebuilderClientProvider).toSelf().inSingletonScope();
        bind(ImageBuilderClientProvider).toService(WorkspaceClusterImagebuilderClientProvider);
        bind(ImageBuilderClientCallMetrics).toService(IClientCallMetrics);

        /* The binding order of the context parser does not configure preference/a working order. Each context parser must be able
         * to decide for themselves, independently and without overlap to the other parsers what to do.
         */
        bind(ContextParser).toSelf().inSingletonScope();
        bind(SnapshotContextParser).toSelf().inSingletonScope();
        bind(IContextParser).to(SnapshotContextParser).inSingletonScope();
        bind(IPrefixContextParser).to(ReferrerPrefixParser).inSingletonScope();
        bind(IPrefixContextParser).to(EnvvarPrefixParser).inSingletonScope();
        bind(IPrefixContextParser).to(ImageBuildPrefixContextParser).inSingletonScope();
        bind(IPrefixContextParser).to(OpenPrebuildPrefixContextParser).inSingletonScope();

        bind(GitTokenScopeGuesser).toSelf().inSingletonScope();
        bind(GitTokenValidator).toSelf().inSingletonScope();

        bind(MonitoringEndpointsApp).toSelf().inSingletonScope();

        bind(HostContainerMapping).toSelf().inSingletonScope();
        bind(HostContextProviderFactory)
            .toDynamicValue(({ container }) => ({
                createHostContext: (config: AuthProviderParams) =>
                    HostContextProviderImpl.createHostContext(container, config),
            }))
            .inSingletonScope();
        bind(HostContextProvider).to(HostContextProviderImpl).inSingletonScope();

        bind(WorkspaceManagerClientProvider).toSelf().inSingletonScope();
        bind(WorkspaceManagerClientProviderCompositeSource).toSelf().inSingletonScope();
        bind(WorkspaceManagerClientProviderSource).to(WorkspaceManagerClientProviderEnvSource).inSingletonScope();
        bind(WorkspaceManagerClientProviderSource).to(WorkspaceManagerClientProviderDBSource).inSingletonScope();
        bind(IWorkspaceManagerClientCallMetrics).toService(IClientCallMetrics);

        bind(WorkspaceDownloadService).toSelf().inSingletonScope();
        bind(LivenessController).toSelf().inSingletonScope();

        bind(OneTimeSecretServer).toSelf().inSingletonScope();

        bind(AuthProviderService).toSelf().inSingletonScope();
        bind(BearerAuth).toSelf().inSingletonScope();

        // binds all content services
        contentServiceBinder((ctx) => {
            const config = ctx.container.get<Config>(Config);
            const options: grpc.ClientOptions = {
                ...defaultGRPCOptions,
            };
            return {
                address: config.contentServiceAddr,
                credentials: grpc.credentials.createInsecure(),
                options,
            };
        })(bind, unbind, isBound, rebind, unbindAsync, onActivation, onDeactivation);

        bind(StorageClient).to(ContentServiceStorageClient).inSingletonScope();

        bind(CodeSyncService).toSelf().inSingletonScope();

        bind(IAnalyticsWriter).toDynamicValue(newAnalyticsWriterFromEnv).inSingletonScope();

        bind(OAuthController).toSelf().inSingletonScope();

        bind(HeadlessLogService).toSelf().inSingletonScope();
        bind(HeadlessLogController).toSelf().inSingletonScope();

        bind(OrganizationService).toSelf().inSingletonScope();
        bind(ProjectsService).toSelf().inSingletonScope();
        bind(ScmService).toSelf().inSingletonScope();

        bind(NewsletterSubscriptionController).toSelf().inSingletonScope();

        bind<UsageServiceClient>(UsageServiceDefinition.name)
            .toDynamicValue((ctx) => {
                const config = ctx.container.get<Config>(Config);
                return createClient(UsageServiceDefinition, createChannel(config.usageServiceAddr));
            })
            .inSingletonScope();

        bind<BillingServiceClient>(BillingServiceDefinition.name)
            .toDynamicValue((ctx) => {
                const config = ctx.container.get<Config>(Config);
                return createClient(BillingServiceDefinition, createChannel(config.usageServiceAddr));
            })
            .inSingletonScope();

        bind<IDEServiceClient>(IDEServiceDefinition.name)
            .toDynamicValue((ctx) => {
                const config = ctx.container.get<Config>(Config);
                const metricsClient = ctx.container.get<IClientCallMetrics>(IClientCallMetrics);
                const options: grpc.ClientOptions = {
                    ...defaultGRPCOptions,
                };
                return createClientFactory()
                    .use(prometheusClientMiddleware(metricsClient))
                    .use(retryMiddleware)
                    .create(IDEServiceDefinition, createChannel(config.ideServiceAddr, undefined, options), {
                        "*": {
                            retryBaseDelayMs: 200,
                            retryMaxAttempts: 15,
                        },
                    });
            })
            .inSingletonScope();

        bind(VerificationService).toSelf().inSingletonScope();

        bind(UsageService).toSelf().inSingletonScope();

        bind(LinkedInService).toSelf().inSingletonScope();

        // IAM Support
        bind(IamSessionApp).toSelf().inSingletonScope();

        // Authorization & Perms
        bind(SpiceDBClientProvider)
            .toDynamicValue((ctx) => {
                const config = spiceDBConfigFromEnv();
                if (!config) {
                    throw new Error("[spicedb] Missing configuration expected in env vars!");
                }
                const clientCallMetrics = ctx.container.get<IClientCallMetrics>(IClientCallMetrics);
                return new SpiceDBClientProvider(config, clientCallMetrics);
            })
            .inSingletonScope();
        bind(SpiceDBAuthorizer).toSelf().inSingletonScope();
        bind(Authorizer)
            .toDynamicValue((ctx) => {
                const authorizer = ctx.container.get<SpiceDBAuthorizer>(SpiceDBAuthorizer);
                return createInitializingAuthorizer(authorizer);
            })
            .inSingletonScope();
        bind(RelationshipUpdater).toSelf().inSingletonScope();

        // grpc / Connect API
        bind(APIUserService).toSelf().inSingletonScope();
        bind(APITeamsService).toSelf().inSingletonScope();
        bind(APIWorkspacesService).toSelf().inSingletonScope();
        bind(APIStatsService).toSelf().inSingletonScope();
        bind(API).toSelf().inSingletonScope();

        bind(AuthJWT).toSelf().inSingletonScope();
        bind(SignInJWT).toSelf().inSingletonScope();

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

        // payment/billing
        bind(StripeService).toSelf().inSingletonScope();

        bind(EntitlementServiceUBP).toSelf().inSingletonScope();
        bind(EntitlementServiceImpl).toSelf().inSingletonScope();
        bind(EntitlementService).to(EntitlementServiceImpl).inSingletonScope();
        bind(BillingModes).toSelf().inSingletonScope();

        // Periodic jobs
        bind(WorkspaceGarbageCollector).toSelf().inSingletonScope();
        bind(TokenGarbageCollector).toSelf().inSingletonScope();
        bind(WebhookEventGarbageCollector).toSelf().inSingletonScope();
        bind(DatabaseGarbageCollector).toSelf().inSingletonScope();
        bind(OTSGarbageCollector).toSelf().inSingletonScope();
        bind(SnapshotsJob).toSelf().inSingletonScope();
        bind(JobRunner).toSelf().inSingletonScope();

        // Redis
        bind(Redis).toDynamicValue((ctx) => {
            const config = ctx.container.get<Config>(Config);
            const [host, port] = config.redis.address.split(":");
            const username = process.env.REDIS_USERNAME;
            const password = process.env.REDIS_PASSWORD;
            return newRedisClient({ host, port: Number(port), connectionName: "server", username, password });
        });

        bind(RedisMutex).toSelf().inSingletonScope();
        bind(RedisSubscriber).toSelf().inSingletonScope();
        bind(RedisPublisher).toSelf().inSingletonScope();
    },
);
