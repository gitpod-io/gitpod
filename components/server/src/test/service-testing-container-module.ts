/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as grpc from "@grpc/grpc-js";
import { IAnalyticsWriter, NullAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { IDEServiceClient, IDEServiceDefinition } from "@gitpod/ide-service-api/lib/ide.pb";
import { UsageServiceDefinition } from "@gitpod/usage-api/lib/usage/v1/usage.pb";
import { ContainerModule } from "inversify";
import { v4 } from "uuid";
import { AuthProvider, AuthProviderParams } from "../auth/auth-provider";
import { HostContextProvider, HostContextProviderFactory } from "../auth/host-context-provider";
import { HostContextProviderImpl } from "../auth/host-context-provider-impl";
import { SpiceDBClientProvider } from "../authorization/spicedb";
import { AuthConfig, Config } from "../config";
import { StorageClient } from "../storage/storage-client";
import { testContainer } from "@gitpod/gitpod-db/lib";
import { productionContainerModule } from "../container-module";
import { createMock } from "./mocks/mock";
import { UsageServiceClientMock } from "./mocks/usage-service-client-mock";
import { env, nextTick } from "process";
import { WorkspaceManagerClientProviderSource } from "@gitpod/ws-manager/lib/client-provider-source";
import { WorkspaceClusterWoTLS } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import {
    BuildInfo,
    BuildResponse,
    BuildStatus,
    IImageBuilderClient,
    LogInfo,
    ResolveWorkspaceImageResponse,
} from "@gitpod/image-builder/lib";
import { IWorkspaceManagerClient, StartWorkspaceResponse } from "@gitpod/ws-manager/lib";
import { TokenProvider } from "../user/token-provider";
import { GitHubScope } from "../github/scopes";
import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";
import * as crypto from "crypto";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Subject, SubjectId } from "../auth/subject-id";
import { User } from "@gitpod/gitpod-protocol";
import { runWithRequestContext } from "../util/request-context";

const signingKeyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const validatingKeyPair1 = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const validatingKeyPair2 = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

export const mockAuthConfig: AuthConfig = {
    pki: {
        signing: toKeyPair("0001", signingKeyPair),
        validating: [toKeyPair("0002", validatingKeyPair1), toKeyPair("0003", validatingKeyPair2)],
    },
    session: {
        issuer: "https://mp-server-d7650ec945.preview.gitpod-dev.com",
        lifetimeSeconds: 7 * 24 * 60 * 60,
        cookie: {
            name: "__Host-_gitpod_dev_jwt_",
            secure: true,
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60,
            sameSite: "lax",
        },
    },
};

function toKeyPair(
    id: string,
    kp: crypto.KeyPairKeyObjectResult,
): {
    id: string;
    privateKey: string;
    publicKey: string;
} {
    return {
        id,
        privateKey: kp.privateKey
            .export({
                type: "pkcs1",
                format: "pem",
            })
            .toString(),
        publicKey: kp.publicKey
            .export({
                type: "pkcs1",
                format: "pem",
            })
            .toString(),
    };
}

/**
 * Expects a fully configured production container and
 *  - replaces all services to external APIs with mocks
 *  - replaces the config with a mock config
 *  - replaces the analytics writer with a null analytics writer
 */
const mockApplyingContainerModule = new ContainerModule((bind, unbound, isbound, rebind) => {
    const webhooks = new Set<String>();
    bind("webhooks").toConstantValue(webhooks);
    rebind(HostContextProvider).toConstantValue({
        get: () => {
            const authProviderId = "Public-GitHub";
            return {
                authProvider: <AuthProvider>{
                    authProviderId,
                    info: {
                        authProviderId,
                        authProviderType: "GitHub",
                    },
                },
                services: {
                    repositoryService: {
                        installAutomatedPrebuilds: async (user: any, cloneUrl: string) => {
                            webhooks.add(cloneUrl);
                        },
                    },
                    repositoryProvider: {
                        hasReadAccess: async (user: any, owner: string, repo: string) => {
                            return true;
                        },
                    },
                },
            };
        },
    });
    rebind(TokenProvider).toConstantValue(<TokenProvider>{
        getTokenForHost: async (user, host) => {
            if (host != "github.com") {
                throw new ApplicationError(ErrorCodes.NOT_FOUND, `SCM Token not found.`);
            }
            return {
                value: "test",
                scopes: [GitHubScope.EMAIL, GitHubScope.PUBLIC, GitHubScope.PRIVATE],
            };
        },
    });
    rebind(UsageServiceDefinition.name).toConstantValue(createMock(new UsageServiceClientMock()));
    rebind(StorageClient).toConstantValue(createMock());
    rebind(WorkspaceManagerClientProviderSource).toDynamicValue((): WorkspaceManagerClientProviderSource => {
        const clusters: WorkspaceClusterWoTLS[] = [
            {
                name: "eu-central-1",
                region: "europe",
                url: "https://ws.gitpod.io",
                state: "available",
                maxScore: 100,
                score: 100,
                govern: true,
                availableWorkspaceClasses: [
                    {
                        creditsPerMinute: 1,
                        description: "2vCPU / 4GB RAM",
                        id: "basic",
                        displayName: "Basic",
                    },
                    {
                        creditsPerMinute: 2,
                        description: "4vCPU / 8GB RAM",
                        id: "pro",
                        displayName: "Pro",
                    },
                ],
            },
            {
                name: "eu-central-1-nextgen",
                region: "europe",
                url: "https://ws.gitpod.io",
                state: "available",
                maxScore: 100,
                score: 100,
                govern: true,
                availableWorkspaceClasses: [
                    {
                        creditsPerMinute: 1,
                        description: "2vCPU / 4GB RAM",
                        id: "basic",
                        displayName: "Basic",
                    },
                    {
                        creditsPerMinute: 1,
                        description: "2vCPU / 4GB RAM",
                        id: "nextgen-basic",
                        displayName: "NextGen Basic",
                    },
                    {
                        creditsPerMinute: 2,
                        description: "4vCPU / 8GB RAM",
                        id: "nextgen-pro",
                        displayName: "NextGen Pro",
                    },
                ],
            },
        ];
        return <WorkspaceManagerClientProviderSource>{
            getAllWorkspaceClusters: async () => {
                return clusters;
            },
            getWorkspaceCluster: async (name: string) => {
                return clusters.find((c) => c.name === name);
            },
        };
    });
    rebind(WorkspaceManagerClientProvider)
        .toSelf()
        .onActivation((_, provider) => {
            provider["createConnection"] = () => {
                const channel = <Partial<grpc.Channel>>{
                    getConnectivityState() {
                        return grpc.connectivityState.READY;
                    },
                };
                return Object.assign(
                    <Partial<grpc.Client>>{
                        getChannel() {
                            return channel;
                        },
                    },
                    <IImageBuilderClient & IWorkspaceManagerClient>{
                        resolveWorkspaceImage(request, metadata, options, callback) {
                            const response = new ResolveWorkspaceImageResponse();
                            response.setStatus(BuildStatus.DONE_SUCCESS);
                            callback(null, response);
                        },
                        build(request, metadata, options) {
                            const listeners = new Map<string | symbol, Function>();
                            nextTick(() => {
                                const response = new BuildResponse();
                                response.setStatus(BuildStatus.DONE_SUCCESS);
                                response.setRef("my-test-build-ref");
                                const buildInfo = new BuildInfo();
                                const logInfo = new LogInfo();
                                logInfo.setUrl("https://ws.gitpod.io/my-test-image-build/logs");
                                buildInfo.setLogInfo(logInfo);
                                response.setInfo(buildInfo);
                                listeners.get("data")!(response);
                                listeners.get("end")!();
                            });
                            return {
                                on(event, callback) {
                                    listeners.set(event, callback);
                                },
                            };
                        },
                        startWorkspace(request, metadata, options, callback) {
                            const workspaceId = request.getServicePrefix();
                            const response = new StartWorkspaceResponse();
                            response.setUrl(`https://${workspaceId}.ws.gitpod.io`);
                            callback(null, response);
                        },
                    },
                ) as any;
            };
            return provider;
        });
    rebind(IDEServiceDefinition.name).toConstantValue(
        createMock(<Partial<IDEServiceClient>>{
            async resolveWorkspaceConfig() {
                return {
                    envvars: [],
                    supervisorImage: "gitpod/supervisor:latest",
                    webImage: "gitpod/code:latest",
                    ideImageLayers: [],
                    refererIde: "code",
                    ideSettings: "",
                    tasks: "",
                };
            },
        }),
    );

    rebind<Partial<Config>>(Config).toConstantValue({
        hostUrl: new GitpodHostUrl("https://gitpod.io"),
        blockNewUsers: {
            enabled: false,
            passlist: [],
        },
        redis: {
            address: (env.REDIS_HOST || "127.0.0.1") + ":" + (env.REDIS_PORT || "6379"),
        },
        workspaceDefaults: {
            workspaceImage: "gitpod/workspace-full",
            defaultFeatureFlags: [],
            previewFeatureFlags: [],
        },
        workspaceClasses: [
            {
                category: "general",
                description: "The default workspace class",
                displayName: "Default",
                id: "default",
                isDefault: true,
                powerups: 0,
            },
        ],
        authProviderConfigs: [],
        installationShortname: "gitpod",
        auth: mockAuthConfig,
        prebuildLimiter: {
            "*": {
                limit: 50,
                period: 50,
            },
        },
    });
    rebind(IAnalyticsWriter).toConstantValue(NullAnalyticsWriter);
    rebind(HostContextProviderFactory)
        .toDynamicValue(({ container }) => ({
            createHostContext: (config: AuthProviderParams) =>
                HostContextProviderImpl.createHostContext(container, config),
        }))
        .inSingletonScope();

    rebind(SpiceDBClientProvider)
        .toDynamicValue(() => {
            const config = {
                token: v4(),
                address: "localhost:50051",
            };
            return new SpiceDBClientProvider(config);
        })
        .inSingletonScope();
});

/**
 *
 * @returns a container that is configured for testing and assumes a running DB, spiceDB and redis
 */
export function createTestContainer() {
    const container = testContainer.createChild();
    container.load(productionContainerModule);
    container.load(mockApplyingContainerModule);
    return container;
}

export function withTestCtx<T>(subject: Subject | User, p: () => Promise<T>): Promise<T> {
    let subjectId: SubjectId | undefined = undefined;
    if (SubjectId.is(subject)) {
        subjectId = subject;
    } else if (subject !== undefined) {
        subjectId = SubjectId.fromUserId(User.is(subject) ? subject.id : subject);
    }
    return runWithRequestContext(
        {
            requestKind: "testContext",
            requestMethod: "testMethod",
            signal: new AbortController().signal,
            subjectId,
        },
        p,
    );
}
