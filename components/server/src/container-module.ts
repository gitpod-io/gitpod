/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";

import { Server } from "./server";
import { Authenticator } from "./auth/authenticator";
import { SessionHandler } from "./session-handler";
import { GitpodFileParser } from "@gitpod/gitpod-protocol/lib/gitpod-file-parser";
import { WorkspaceFactory } from "./workspace/workspace-factory";
import { ServerFactory, UserController } from "./user/user-controller";
import { GitpodServerImpl } from "./workspace/gitpod-server-impl";
import { ConfigProvider } from "./workspace/config-provider";
import { MessageBusIntegration } from "./workspace/messagebus-integration";
import { MessageBusHelper, MessageBusHelperImpl } from "@gitpod/gitpod-messagebus/lib";
import { ConfigurationService } from "./config/configuration-service";
import { IContextParser, IPrefixContextParser } from "./workspace/context-parser";
import { ContextParser } from "./workspace/context-parser-service";
import { SnapshotContextParser } from "./workspace/snapshot-context-parser";
import { MessagebusConfiguration } from "@gitpod/gitpod-messagebus/lib/config";
import { HostContextProvider, HostContextProviderFactory } from "./auth/host-context-provider";
import { TokenService } from "./user/token-service";
import { TokenProvider } from "./user/token-provider";
import { UserService } from "./user/user-service";
import { UserDeletionService } from "./user/user-deletion-service";
import { WorkspaceDeletionService } from "./workspace/workspace-deletion-service";
import { EnvvarPrefixParser } from "./workspace/envvar-prefix-context-parser";
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
import { WorkspaceStarter } from "./workspace/workspace-starter";
import { TracingManager } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { AuthorizationService, AuthorizationServiceImpl } from "./user/authorization-service";
import { StorageClient } from "./storage/storage-client";
import { ImageBuilderClientProvider, ImageBuilderClientCallMetrics } from "@gitpod/image-builder/lib";
import { ImageSourceProvider } from "./workspace/image-source-provider";
import { WorkspaceGarbageCollector } from "./jobs/workspace-gc";
import { TokenGarbageCollector } from "./jobs/token-gc";
import { WorkspaceDownloadService } from "./workspace/workspace-download-service";
import { WebsocketConnectionManager } from "./websocket/websocket-connection-manager";
import { OneTimeSecretServer } from "./one-time-secret-server";
import { HostContainerMapping } from "./auth/host-container-mapping";
import { AuthProviderService } from "./auth/auth-provider-service";
import { HostContextProviderImpl } from "./auth/host-context-provider-impl";
import { AuthProviderParams } from "./auth/auth-provider";
import { LoginCompletionHandler } from "./auth/login-completion-handler";
import { MonitoringEndpointsApp } from "./monitoring-endpoints";
import { BearerAuth } from "./auth/bearer-authenticator";
import * as grpc from "@grpc/grpc-js";
import { CodeSyncService } from "./code-sync/code-sync-service";
import { ContentServiceStorageClient } from "./storage/content-service-client";
import { GitTokenScopeGuesser } from "./workspace/git-token-scope-guesser";
import { GitTokenValidator } from "./workspace/git-token-validator";
import { newAnalyticsWriterFromEnv } from "@gitpod/gitpod-protocol/lib/util/analytics";
import { OAuthController } from "./oauth-server/oauth-controller";
import { ImageBuildPrefixContextParser } from "./workspace/imagebuild-prefix-context-parser";
import { HeadlessLogService } from "./workspace/headless-log-service";
import { HeadlessLogController } from "./workspace/headless-log-controller";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { ProjectsService } from "./projects/projects-service";
import { NewsletterSubscriptionController } from "./user/newsletter-subscription-controller";
import { Config, ConfigFile } from "./config";
import { defaultGRPCOptions } from "@gitpod/gitpod-protocol/lib/util/grpc";
import { PrometheusClientCallMetrics } from "@gitpod/gitpod-protocol/lib/messaging/client-call-metrics";
import { IClientCallMetrics } from "@gitpod/gitpod-protocol/lib/util/grpc";
import { DebugApp } from "@gitpod/gitpod-protocol/lib/util/debug-app";
import { LocalMessageBroker, LocalRabbitMQBackedMessageBroker } from "./messaging/local-message-broker";
import { ReferrerPrefixParser } from "./workspace/referrer-prefix-context-parser";
import { IDEService } from "./ide-service";
import { WorkspaceClusterImagebuilderClientProvider } from "./workspace/workspace-cluster-imagebuilder-client-provider";
import { UsageServiceClient, UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { BillingServiceClient, BillingServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/billing.pb";
import { createChannel, createClient, createClientFactory } from "nice-grpc";
import { EntitlementService, EntitlementServiceImpl } from "./billing/entitlement-service";
import {
    ConfigCatClientFactory,
    getExperimentsClientForBackend,
} from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { VerificationService } from "./auth/verification-service";
import { WebhookEventGarbageCollector } from "./jobs/webhook-gc";
import { LivenessController } from "./liveness/liveness-controller";
import { IDEServiceClient, IDEServiceDefinition } from "@gitpod/ide-service-api/lib/ide.pb";
import { prometheusClientMiddleware } from "@gitpod/gitpod-protocol/lib/util/nice-grpc";
import { NoOpUsageService, UsageService, UsageServiceImpl } from "./user/usage-service";
import { OpenPrebuildPrefixContextParser } from "./workspace/open-prebuild-prefix-context-parser";
import { contentServiceBinder } from "./util/content-service-sugar";
import { retryMiddleware } from "nice-grpc-client-middleware-retry";
import { IamSessionApp } from "./iam/iam-session-app";
import { spicedbClientFromEnv, SpiceDBClient } from "./authorization/spicedb";
import { Authorizer, PermissionChecker } from "./authorization/perms";
import { EnvVarService } from "./workspace/env-var-service";
import { APIUserService } from "./api/user";
import { APITeamsService } from "./api/teams";
import { API } from "./api/server";
import { LinkedInService } from "./linkedin-service";
import { AuthJWT, SignInJWT } from "./auth/jwt";
import { SnapshotService } from "./workspace/snapshot-service";
import { APIWorkspacesService } from "./api/workspaces";
import { PrebuildManager } from "./prebuilds/prebuild-manager";
import { StartPrebuildContextParser } from "./prebuilds/start-prebuild-context-parser";
import { GithubApp } from "./prebuilds/github-app";
import { GitHubAppSupport } from "./github/github-app-support";
import { GithubAppRules } from "./prebuilds/github-app-rules";
import { PrebuildStatusMaintainer } from "./prebuilds/prebuilt-status-maintainer";
import { GitLabApp } from "./prebuilds/gitlab-app";
import { GitLabAppSupport } from "./gitlab/gitlab-app-support";
import { BitbucketApp } from "./prebuilds/bitbucket-app";
import { BitbucketAppSupport } from "./bitbucket/bitbucket-app-support";
import { GitHubEnterpriseApp } from "./prebuilds/github-enterprise-app";
import { BitbucketServerApp } from "./prebuilds/bitbucket-server-app";
import { IncrementalPrebuildsService } from "./prebuilds/incremental-prebuilds-service";
import { RedisClient } from "./redis/client";
import { RedisMutex } from "./redis/mutex";
import { BillingModes, BillingModesImpl } from "./billing/billing-mode";
import { EntitlementServiceUBP } from "./billing/entitlement-service-ubp";
import { StripeService } from "./user/stripe-service";
import { JobRunner } from "./jobs/runner";
import { DatabaseGarbageCollector } from "./jobs/database-gc";
import { OTSGarbageCollector } from "./jobs/ots-gc";
import { UserToTeamMigrationService } from "./migration/user-to-team-migration-service";
import { SnapshotsJob } from "./jobs/snapshots";
import { OrgOnlyMigrationJob } from "./jobs/org-only-migration-job";
import { APIStatsService } from "./api/stats";
import { FixStripeJob } from "./jobs/fix-stripe-job";

export const productionContainerModule = new ContainerModule(
    (bind, unbind, isBound, rebind, unbindAsync, onActivation, onDeactivation) => {
        // gpl: Making this dynamic enables re-use insides tests
        bind(Config)
            .toDynamicValue((ctx) => ConfigFile.fromFile())
            .inSingletonScope();
        bind(IDEService).toSelf().inSingletonScope();

        bind(UserService).toSelf().inSingletonScope();
        bind(UserDeletionService).toSelf().inSingletonScope();
        bind(AuthorizationService).to(AuthorizationServiceImpl).inSingletonScope();

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
        bind(WorkspaceFactory).toSelf().inSingletonScope();
        bind(WorkspaceDeletionService).toSelf().inSingletonScope();
        bind(WorkspaceStarter).toSelf().inSingletonScope();
        bind(ImageSourceProvider).toSelf().inSingletonScope();

        bind(ServerFactory).toAutoFactory(GitpodServerImpl);
        bind(UserController).toSelf().inSingletonScope();

        bind(MessagebusConfiguration).toSelf().inSingletonScope();
        bind(MessageBusHelper).to(MessageBusHelperImpl).inSingletonScope();
        bind(MessageBusIntegration).toSelf().inSingletonScope();
        bind(LocalMessageBroker).to(LocalRabbitMQBackedMessageBroker).inSingletonScope();

        bind(GitpodServerImpl).toSelf();
        bind(WebsocketConnectionManager)
            .toDynamicValue((ctx) => {
                const serverFactory = () => ctx.container.get<GitpodServerImpl>(GitpodServerImpl);
                const hostContextProvider = ctx.container.get<HostContextProvider>(HostContextProvider);
                const config = ctx.container.get<Config>(Config);
                return new WebsocketConnectionManager(serverFactory, hostContextProvider, config.rateLimiter);
            })
            .inSingletonScope();

        bind(PrometheusClientCallMetrics).toSelf().inSingletonScope();
        bind(IClientCallMetrics).to(PrometheusClientCallMetrics).inSingletonScope();

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

        bind(TracingManager).toSelf().inSingletonScope();

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

        bind(ProjectsService).toSelf().inSingletonScope();

        bind(EnvVarService).toSelf().inSingletonScope();

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

        bind(ConfigCatClientFactory)
            .toDynamicValue((ctx) => {
                return () => getExperimentsClientForBackend();
            })
            .inSingletonScope();

        bind(VerificationService).toSelf().inSingletonScope();

        bind(UsageServiceImpl).toSelf().inSingletonScope();
        bind(UsageService).toService(UsageServiceImpl);

        bind(LinkedInService).toSelf().inSingletonScope();
        bind(UserToTeamMigrationService).toSelf().inSingletonScope();

        // IAM Support
        bind(IamSessionApp).toSelf().inSingletonScope();

        // Authorization & Perms
        bind(SpiceDBClient)
            .toDynamicValue(() => spicedbClientFromEnv())
            .inSingletonScope();
        bind(PermissionChecker).to(Authorizer).inSingletonScope();

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
        bind(BillingModes).to(BillingModesImpl).inSingletonScope();

        // Periodic jobs
        bind(WorkspaceGarbageCollector).toSelf().inSingletonScope();
        bind(TokenGarbageCollector).toSelf().inSingletonScope();
        bind(WebhookEventGarbageCollector).toSelf().inSingletonScope();
        bind(DatabaseGarbageCollector).toSelf().inSingletonScope();
        bind(OTSGarbageCollector).toSelf().inSingletonScope();
        bind(SnapshotsJob).toSelf().inSingletonScope();
        bind(OrgOnlyMigrationJob).toSelf().inSingletonScope();
        bind(FixStripeJob).toSelf().inSingletonScope();
        bind(JobRunner).toSelf().inSingletonScope();

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

        bind(RedisClient).toSelf().inSingletonScope();
        bind(RedisMutex).toSelf().inSingletonScope();
    },
);
