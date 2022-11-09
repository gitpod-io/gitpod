/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ContainerModule } from "inversify";

import { Server } from "./server";
import { Authenticator } from "./auth/authenticator";
import { SessionHandlerProvider } from "./session-handler";
import { GitpodFileParser } from "@gitpod/gitpod-protocol/lib/gitpod-file-parser";
import { WorkspaceFactory } from "./workspace/workspace-factory";
import { UserController } from "./user/user-controller";
import { InstallationAdminController } from "./installation-admin/installation-admin-controller";
import { GitpodServerImpl } from "./workspace/gitpod-server-impl";
import { ConfigProvider } from "./workspace/config-provider";
import { MessageBusIntegration } from "./workspace/messagebus-integration";
import { MessageBusHelper, MessageBusHelperImpl } from "@gitpod/gitpod-messagebus/lib";
import {
    IClientDataPrometheusAdapter,
    ClientDataPrometheusAdapterImpl,
} from "./workspace/client-data-prometheus-adapter";
import { ConfigurationService } from "./config/configuration-service";
import { IContextParser, IPrefixContextParser } from "./workspace/context-parser";
import { ContextParser } from "./workspace/context-parser-service";
import { SnapshotContextParser } from "./workspace/snapshot-context-parser";
import { EnforcementController, EnforcementControllerServerFactory } from "./user/enforcement-endpoint";
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
import { ConsensusLeaderMessenger } from "./consensus/consensus-leader-messenger";
import { RabbitMQConsensusLeaderMessenger } from "./consensus/rabbitmq-consensus-leader-messenger";
import { ConsensusLeaderQorum } from "./consensus/consensus-leader-quorum";
import { StorageClient } from "./storage/storage-client";
import {
    ImageBuilderClientConfig,
    ImageBuilderClientProvider,
    CachingImageBuilderClientProvider,
    ImageBuilderClientCallMetrics,
} from "@gitpod/image-builder/lib";
import { ImageSourceProvider } from "./workspace/image-source-provider";
import { WorkspaceGarbageCollector } from "./workspace/garbage-collector";
import { TokenGarbageCollector } from "./user/token-garbage-collector";
import { WebsocketConnectionManager } from "./websocket/websocket-connection-manager";
import { OneTimeSecretServer } from "./one-time-secret-server";
import { HostContainerMapping } from "./auth/host-container-mapping";
import { BlockedUserFilter, NoOneBlockedUserFilter } from "./auth/blocked-user-filter";
import { AuthProviderService } from "./auth/auth-provider-service";
import { HostContextProviderImpl } from "./auth/host-context-provider-impl";
import { AuthProviderParams } from "./auth/auth-provider";
import { LoginCompletionHandler } from "./auth/login-completion-handler";
import { MonitoringEndpointsApp } from "./monitoring-endpoints";
import { BearerAuth } from "./auth/bearer-authenticator";
import { TermsProvider } from "./terms/terms-provider";
import { TosCookie } from "./user/tos-cookie";
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
import { InstallationAdminTelemetryDataProvider } from "./installation-admin/telemetry-data-provider";
import { IDEService } from "./ide-service";
import { LicenseEvaluator } from "@gitpod/licensor/lib";
import { WorkspaceClusterImagebuilderClientProvider } from "./workspace/workspace-cluster-imagebuilder-client-provider";
import { UsageServiceClient, UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { BillingServiceClient, BillingServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/billing.pb";
import { createChannel, createClient, createClientFactory } from "nice-grpc";
import { CommunityEntitlementService, EntitlementService } from "./billing/entitlement-service";
import {
    ConfigCatClientFactory,
    getExperimentsClientForBackend,
} from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { VerificationService } from "./auth/verification-service";
import { WebhookEventGarbageCollector } from "./projects/webhook-event-garbage-collector";
import { LivenessController } from "./liveness/liveness-controller";
import { IDEServiceClient, IDEServiceDefinition } from "@gitpod/ide-service-api/lib/ide.pb";
import { prometheusClientMiddleware } from "@gitpod/gitpod-protocol/lib/util/nice-grpc";
import { UsageService, UsageServiceImpl } from "./user/usage-service";
import { OpenPrebuildPrefixContextParser } from "./workspace/open-prebuild-prefix-context-parser";
import { contentServiceBinder } from "./util/content-service-sugar";

export const productionContainerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(Config).toConstantValue(ConfigFile.fromFile());
    bind(IDEService).toSelf().inSingletonScope();

    bind(UserService).toSelf().inSingletonScope();
    bind(UserDeletionService).toSelf().inSingletonScope();
    bind(AuthorizationService).to(AuthorizationServiceImpl).inSingletonScope();

    bind(TokenService).toSelf().inSingletonScope();
    bind(TokenProvider).toService(TokenService);
    bind(TokenGarbageCollector).toSelf().inSingletonScope();

    bind(Authenticator).toSelf().inSingletonScope();
    bind(LoginCompletionHandler).toSelf().inSingletonScope();
    bind(TosCookie).toSelf().inSingletonScope();

    bind(SessionHandlerProvider).toSelf().inSingletonScope();
    bind(Server).toSelf().inSingletonScope();
    bind(DebugApp).toSelf().inSingletonScope();

    bind(GitpodFileParser).toSelf().inSingletonScope();

    bind(ConfigProvider).toSelf().inSingletonScope();
    bind(ConfigurationService).toSelf().inSingletonScope();

    bind(WorkspaceFactory).toSelf().inSingletonScope();
    bind(WorkspaceDeletionService).toSelf().inSingletonScope();
    bind(WorkspaceStarter).toSelf().inSingletonScope();
    bind(ImageSourceProvider).toSelf().inSingletonScope();

    bind(UserController).toSelf().inSingletonScope();
    bind(EnforcementControllerServerFactory).toAutoFactory(GitpodServerImpl);
    bind(EnforcementController).toSelf().inSingletonScope();

    bind(InstallationAdminController).toSelf().inSingletonScope();

    bind(MessagebusConfiguration).toSelf().inSingletonScope();
    bind(MessageBusHelper).to(MessageBusHelperImpl).inSingletonScope();
    bind(MessageBusIntegration).toSelf().inSingletonScope();
    bind(LocalMessageBroker).to(LocalRabbitMQBackedMessageBroker).inSingletonScope();

    bind(IClientDataPrometheusAdapter).to(ClientDataPrometheusAdapterImpl).inSingletonScope();

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

    bind(ImageBuilderClientConfig).toDynamicValue((ctx) => {
        const config = ctx.container.get<Config>(Config);
        return { address: config.imageBuilderAddr };
    });
    bind(CachingImageBuilderClientProvider).toSelf().inSingletonScope();
    bind(WorkspaceClusterImagebuilderClientProvider).toSelf().inSingletonScope(); // during the transition period, we have two kinds of image builder client providers
    bind(ImageBuilderClientProvider).toService(CachingImageBuilderClientProvider);
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

    bind(BlockedUserFilter).to(NoOneBlockedUserFilter).inSingletonScope();

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

    bind(RabbitMQConsensusLeaderMessenger).toSelf().inSingletonScope();
    bind(ConsensusLeaderMessenger).toService(RabbitMQConsensusLeaderMessenger);
    bind(ConsensusLeaderQorum).toSelf().inSingletonScope();

    bind(WorkspaceGarbageCollector).toSelf().inSingletonScope();
    bind(LivenessController).toSelf().inSingletonScope();

    bind(OneTimeSecretServer).toSelf().inSingletonScope();

    bind(AuthProviderService).toSelf().inSingletonScope();
    bind(BearerAuth).toSelf().inSingletonScope();

    bind(TermsProvider).toSelf().inSingletonScope();

    bind(InstallationAdminTelemetryDataProvider).toSelf().inSingletonScope();

    bind(LicenseEvaluator).toSelf().inSingletonScope();

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
    })(bind, unbind, isBound, rebind);

    bind(StorageClient).to(ContentServiceStorageClient).inSingletonScope();

    bind(CodeSyncService).toSelf().inSingletonScope();

    bind(IAnalyticsWriter).toDynamicValue(newAnalyticsWriterFromEnv).inSingletonScope();

    bind(OAuthController).toSelf().inSingletonScope();

    bind(HeadlessLogService).toSelf().inSingletonScope();
    bind(HeadlessLogController).toSelf().inSingletonScope();

    bind(ProjectsService).toSelf().inSingletonScope();

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
            return createClientFactory()
                .use(prometheusClientMiddleware(metricsClient))
                .create(IDEServiceDefinition, createChannel(config.ideServiceAddr));
        })
        .inSingletonScope();

    bind(EntitlementService).to(CommunityEntitlementService).inSingletonScope();

    bind(ConfigCatClientFactory)
        .toDynamicValue((ctx) => {
            return () => getExperimentsClientForBackend();
        })
        .inSingletonScope();

    bind(VerificationService).toSelf().inSingletonScope();

    bind(WebhookEventGarbageCollector).toSelf().inSingletonScope();

    bind(UsageServiceImpl).toSelf().inSingletonScope();
    bind(UsageService).toService(UsageServiceImpl);
});
