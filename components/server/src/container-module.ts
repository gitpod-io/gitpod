/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ContainerModule } from 'inversify';

import { Server } from './server';
import { Authenticator } from './auth/authenticator';
import { Env } from './env';
import { SessionHandlerProvider } from './session-handler';
import { GitpodFileParser } from '@gitpod/gitpod-protocol/lib/gitpod-file-parser';
import { WorkspaceFactory } from './workspace/workspace-factory';
import { UserController } from './user/user-controller';
import { GitpodServerImpl } from './workspace/gitpod-server-impl';
import { ConfigProvider } from './workspace/config-provider';
import { MessageBusIntegration } from './workspace/messagebus-integration';
import { MessageBusHelper, MessageBusHelperImpl } from '@gitpod/gitpod-messagebus/lib';
import { IClientDataPrometheusAdapter, ClientDataPrometheusAdapterImpl } from './workspace/client-data-prometheus-adapter';
import { ConfigInferenceProvider } from './workspace/config-inference-provider';
import { IContextParser, IPrefixContextParser } from './workspace/context-parser';
import { ContextParser } from './workspace/context-parser-service';
import { SnapshotContextParser } from './workspace/snapshot-context-parser';
import { GitpodCookie } from './auth/gitpod-cookie';
import { EnforcementController, EnforcementControllerServerFactory } from './user/enforcement-endpoint';
import { MessagebusConfiguration } from '@gitpod/gitpod-messagebus/lib/config';
import { HostContextProvider, HostContextProviderFactory } from './auth/host-context-provider';
import { TokenService } from './user/token-service';
import { TokenProvider } from './user/token-provider';
import { UserService } from './user/user-service';
import { UserDeletionService } from './user/user-deletion-service';
import { WorkspaceDeletionService } from './workspace/workspace-deletion-service';
import { GCloudStorageClient } from './storage/gcloud-storage-client';
import { EnvvarPrefixParser } from './workspace/envvar-prefix-context-parser';
import { WorkspaceManagerClientProvider, WorkspaceManagerClientProviderConfig, WorkspaceManagerClientProviderEnvConfig } from '@gitpod/ws-manager/lib/client-provider';
import { WorkspaceStarter } from './workspace/workspace-starter';
import { TracingManager } from '@gitpod/gitpod-protocol/lib/util/tracing';
import { AuthorizationService, AuthorizationServiceImpl } from './user/authorization-service';
import { TheiaPluginService } from './theia-plugin/theia-plugin-service';
import { TheiaPluginController } from './theia-plugin/theia-plugin-controller';
import { ConsensusLeaderMessenger } from './consensus/consensus-leader-messenger';
import { RabbitMQConsensusLeaderMessenger } from './consensus/rabbitmq-consensus-leader-messenger';
import { ConsensusLeaderQorum } from './consensus/consensus-leader-quorum';
import { StorageClient } from './storage/storage-client';
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { MinIOStorageClient } from './storage/minio-storage-client';
import { Client } from 'minio';
import { ImageBuilderClientConfig, ImageBuilderClientProvider, CachingImageBuilderClientProvider } from '@gitpod/image-builder/lib';
import { ImageSourceProvider } from './workspace/image-source-provider';
import { WorkspaceGarbageCollector } from './workspace/garbage-collector';
import { TokenGarbageCollector } from './user/token-garbage-collector';
import { filePathTelepresenceAware } from '@gitpod/gitpod-protocol/lib/env';
import { WorkspaceDownloadService } from './workspace/workspace-download-service';
import { WorkspacePortAuthorizationService } from './user/workspace-port-auth-service';
import { WebsocketConnectionManager } from './websocket-connection-manager';
import { OneTimeSecretServer } from './one-time-secret-server';
import { GitpodServer, GitpodClient } from '@gitpod/gitpod-protocol';
import { HostContainerMapping } from './auth/host-container-mapping';
import { BlockedUserFilter, NoOneBlockedUserFilter } from './auth/blocked-user-filter';
import { AuthProviderEntryDB } from '@gitpod/gitpod-db/lib/auth-provider-entry-db';
import { AuthProviderEntryDBImpl } from '@gitpod/gitpod-db/lib/typeorm/auth-provider-entry-db-impl';
import { AuthProviderService } from './auth/auth-provider-service';
import { HostContextProviderImpl } from './auth/host-context-provider-impl';
import { AuthProviderParams } from './auth/auth-provider';
import { LoginCompletionHandler } from './auth/login-completion-handler';
import { MonitoringEndpointsApp } from './monitoring-endpoints';
import { BearerAuth } from './auth/bearer-authenticator';
import { TermsProvider } from './terms/terms-provider';
import { TosCookie } from './user/tos-cookie';
import { BlobServiceClient } from '@gitpod/content-service/lib/blobs_grpc_pb';
import * as grpc from "grpc";

export const productionContainerModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(Env).toSelf().inSingletonScope();

    bind(UserService).toSelf().inSingletonScope();
    bind(UserDeletionService).toSelf().inSingletonScope();
    bind(AuthorizationService).to(AuthorizationServiceImpl).inSingletonScope();

    bind(TokenService).toSelf().inSingletonScope();
    bind(TokenProvider).toService(TokenService);
    bind(TokenGarbageCollector).toSelf().inSingletonScope();

    bind(Authenticator).toSelf().inSingletonScope();
    bind(LoginCompletionHandler).toSelf().inSingletonScope();
    bind(GitpodCookie).toSelf().inSingletonScope();
    bind(TosCookie).toSelf().inSingletonScope();

    bind(SessionHandlerProvider).toSelf().inSingletonScope();
    bind(Server).toSelf().inSingletonScope();

    bind(GitpodFileParser).toSelf().inSingletonScope();

    bind(ConfigProvider).toSelf().inSingletonScope();
    bind(ConfigInferenceProvider).toSelf().inSingletonScope();

    bind(WorkspaceFactory).toSelf().inSingletonScope();
    bind(WorkspaceDeletionService).toSelf().inSingletonScope();
    bind(WorkspaceStarter).toSelf().inSingletonScope();
    bind(ImageSourceProvider).toSelf().inSingletonScope();

    bind(UserController).toSelf().inSingletonScope();
    bind(EnforcementControllerServerFactory).toAutoFactory(GitpodServerImpl);
    bind(EnforcementController).toSelf().inSingletonScope();
    bind(TheiaPluginController).toSelf().inSingletonScope();

    bind(MessagebusConfiguration).toSelf().inSingletonScope();
    bind(MessageBusHelper).to(MessageBusHelperImpl).inSingletonScope();
    bind(MessageBusIntegration).toSelf().inSingletonScope();

    bind(IClientDataPrometheusAdapter).to(ClientDataPrometheusAdapterImpl).inSingletonScope();

    bind(GitpodServerImpl).toSelf();
    bind(WebsocketConnectionManager).toDynamicValue(ctx =>
        new WebsocketConnectionManager<GitpodClient, GitpodServer>(() => ctx.container.get<GitpodServerImpl<GitpodClient, GitpodServer>>(GitpodServerImpl))
    ).inSingletonScope();

    bind(ImageBuilderClientConfig).toDynamicValue(() => {
        return { address: "image-builder:8080" }
    });
    bind(CachingImageBuilderClientProvider).toSelf().inSingletonScope();
    bind(ImageBuilderClientProvider).toService(CachingImageBuilderClientProvider);

    /* The binding order of the context parser does not configure preference/a working prder. Each context parser must be able
     * to decide for themselves, independently and without overlap to the other parsers what to do.
     */
    bind(ContextParser).toSelf().inSingletonScope();
    bind(SnapshotContextParser).toSelf().inSingletonScope();
    bind(IContextParser).to(SnapshotContextParser).inSingletonScope();
    bind(IPrefixContextParser).to(EnvvarPrefixParser).inSingletonScope();

    bind(BlockedUserFilter).to(NoOneBlockedUserFilter).inSingletonScope();

    bind(MonitoringEndpointsApp).toSelf().inSingletonScope();

    bind(HostContainerMapping).toSelf().inSingletonScope();
    bind(HostContextProviderFactory).toDynamicValue(({ container }) => ({
        createHostContext: (config: AuthProviderParams) => HostContextProviderImpl.createHostContext(container, config)
    })).inSingletonScope();
    bind(HostContextProvider).to(HostContextProviderImpl).inSingletonScope();

    bind(GCloudStorageClient).toDynamicValue(ctx => {
        const env = ctx.container.get(Env);
        if (!env.gcloudCredentialsFile || !env.gcloudProjectID) {
            throw "no GCloud config found";
        }

        return new GCloudStorageClient({
            keyFilename: filePathTelepresenceAware("/storageKeySecret/" + env.gcloudCredentialsFile),
            projectId: env.gcloudProjectID,
            stage: env.kubeStage,
            region: env.gcloudRegion,
        });
    }).inSingletonScope();
    bind(MinIOStorageClient).toDynamicValue(ctx => {
        const env = ctx.container.get(Env);
        return new MinIOStorageClient(new Client({
            endPoint: env.minioEndPoint!,
            port: parseInt(env.minioPort!),
            accessKey: env.minioAccessKey!,
            secretKey: env.minioSecretKey!,
            region: env.minioRegion!,
            useSSL: env.minioUseSSL,
        }), env.minioRegion!);
    });
    bind(StorageClient).toDynamicValue(ctx => {
        const env = ctx.container.get(Env);

        if (env.storageClient === 'minio') {
            log.info("Using MinIO storage client");
            return ctx.container.get(MinIOStorageClient);
        } else {
            log.info("Using GCloud storage client")
            return ctx.container.get(GCloudStorageClient);
        }
    }).inSingletonScope();

    bind(TracingManager).toSelf().inSingletonScope();

    bind(WorkspaceManagerClientProvider).toSelf().inSingletonScope();
    bind(WorkspaceManagerClientProviderConfig).to(WorkspaceManagerClientProviderEnvConfig).inSingletonScope();

    bind(TheiaPluginService).toSelf().inSingletonScope();

    bind(RabbitMQConsensusLeaderMessenger).toSelf().inSingletonScope();
    bind(ConsensusLeaderMessenger).toService(RabbitMQConsensusLeaderMessenger);
    bind(ConsensusLeaderQorum).toSelf().inSingletonScope();

    bind(WorkspaceGarbageCollector).toSelf().inSingletonScope();
    bind(WorkspaceDownloadService).toSelf().inSingletonScope();

    bind(WorkspacePortAuthorizationService).toSelf().inSingletonScope();

    bind(OneTimeSecretServer).toSelf().inSingletonScope();

    bind(AuthProviderEntryDB).to(AuthProviderEntryDBImpl).inSingletonScope();
    bind(AuthProviderService).toSelf().inSingletonScope();
    bind(BearerAuth).toSelf().inSingletonScope();

    bind(TermsProvider).toSelf().inSingletonScope();

    const blobServiceClient = new BlobServiceClient("content-service:8080", grpc.credentials.createInsecure())
    bind(BlobServiceClient).toConstantValue(blobServiceClient);
});
