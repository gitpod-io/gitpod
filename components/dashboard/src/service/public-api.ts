/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PartialMessage } from "@bufbuild/protobuf";
import { MethodKind, ServiceType } from "@bufbuild/protobuf";
import { CallOptions, Code, ConnectError, PromiseClient, createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { Disposable, User } from "@gitpod/gitpod-protocol";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { Project as ProtocolProject } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { HelloService } from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_connect";
import { OIDCService } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_connect";
import { ProjectsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/projects_connect";
import { Project } from "@gitpod/public-api/lib/gitpod/experimental/v1/projects_pb";
import { TokensService } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_connect";
import { WorkspacesService as WorkspaceV1Service } from "@gitpod/public-api/lib/gitpod/experimental/v1/workspaces_connect";
import { OrganizationService } from "@gitpod/public-api/lib/gitpod/v1/organization_connect";
import { WorkspaceService } from "@gitpod/public-api/lib/gitpod/v1/workspace_connect";
import { ConfigurationService } from "@gitpod/public-api/lib/gitpod/v1/configuration_connect";
import { PrebuildService } from "@gitpod/public-api/lib/gitpod/v1/prebuild_connect";
import { getMetricsInterceptor } from "@gitpod/public-api/lib/metrics";
import { getExperimentsClient } from "../experiments/client";
import { JsonRpcOrganizationClient } from "./json-rpc-organization-client";
import { JsonRpcWorkspaceClient } from "./json-rpc-workspace-client";
import { JsonRpcAuthProviderClient } from "./json-rpc-authprovider-client";
import { AuthProviderService } from "@gitpod/public-api/lib/gitpod/v1/authprovider_connect";
import { EnvironmentVariableService } from "@gitpod/public-api/lib/gitpod/v1/envvar_connect";
import { JsonRpcEnvvarClient } from "./json-rpc-envvar-client";
import { Prebuild, WatchPrebuildRequest, WatchPrebuildResponse } from "@gitpod/public-api/lib/gitpod/v1/prebuild_pb";
import { JsonRpcPrebuildClient } from "./json-rpc-prebuild-client";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { JsonRpcScmClient } from "./json-rpc-scm-client";
import { SCMService } from "@gitpod/public-api/lib/gitpod/v1/scm_connect";
import { SSHService } from "@gitpod/public-api/lib/gitpod/v1/ssh_connect";
import { JsonRpcSSHClient } from "./json-rpc-ssh-client";

const transport = createConnectTransport({
    baseUrl: `${window.location.protocol}//${window.location.host}/public-api`,
    interceptors: [getMetricsInterceptor()],
});

export const converter = new PublicAPIConverter();

export const helloService = createPromiseClient(HelloService, transport);
export const personalAccessTokensService = createPromiseClient(TokensService, transport);
export const projectsService = createPromiseClient(ProjectsService, transport);
/**
 * @deprecated use workspaceClient instead
 */
export const workspacesService = createPromiseClient(WorkspaceV1Service, transport);
export const oidcService = createPromiseClient(OIDCService, transport);

export const workspaceClient = createServiceClient(WorkspaceService, new JsonRpcWorkspaceClient());
export const organizationClient = createServiceClient(
    OrganizationService,
    new JsonRpcOrganizationClient(),
    "organization",
);
// No jsonrcp client for the configuration service as it's only used in new UI of the dashboard
export const configurationClient = createServiceClient(ConfigurationService);
export const prebuildClient = createServiceClient(PrebuildService, new JsonRpcPrebuildClient());

export const authProviderClient = createServiceClient(AuthProviderService, new JsonRpcAuthProviderClient());

export const scmClient = createServiceClient(SCMService, new JsonRpcScmClient());

export const envVarClient = createServiceClient(EnvironmentVariableService, new JsonRpcEnvvarClient());

export const sshClient = createServiceClient(SSHService, new JsonRpcSSHClient());

export async function listAllProjects(opts: { orgId: string }): Promise<ProtocolProject[]> {
    let pagination = {
        page: 1,
        pageSize: 100,
    };

    const response = await projectsService.listProjects({
        teamId: opts.orgId,
        pagination,
    });
    const results = response.projects;

    while (results.length < response.totalResults) {
        pagination = {
            pageSize: 100,
            page: 1 + pagination.page,
        };
        const response = await projectsService.listProjects({
            teamId: opts.orgId,
            pagination,
        });
        results.push(...response.projects);
    }

    return results.map(projectToProtocol);
}

export function projectToProtocol(project: Project): ProtocolProject {
    return {
        id: project.id,
        name: project.name,
        cloneUrl: project.cloneUrl,
        creationTime: project.creationTime?.toDate().toISOString() || "",
        teamId: project.teamId,
        appInstallationId: "undefined",
        settings: {
            workspaceClasses: {
                regular: project.settings?.workspace?.workspaceClass?.regular || "",
            },
            prebuilds: {
                enable: project.settings?.prebuild?.enablePrebuilds,
                branchStrategy: project.settings?.prebuild?.branchStrategy as any,
                branchMatchingPattern: project.settings?.prebuild?.branchMatchingPattern,
                prebuildInterval: project.settings?.prebuild?.prebuildInterval,
                workspaceClass: project.settings?.prebuild?.workspaceClass,
            },
        },
    };
}

let user: User | undefined;
export function updateUser(newUser: User | undefined) {
    user = newUser;
}

function createServiceClient<T extends ServiceType>(
    type: T,
    jsonRpcClient?: PromiseClient<T>,
    featureFlagSuffix?: string,
): PromiseClient<T> {
    return new Proxy(createPromiseClient(type, transport), {
        get(grpcClient, prop) {
            const experimentsClient = getExperimentsClient();
            // TODO(ak) remove after migration
            async function resolveClient(): Promise<PromiseClient<T>> {
                if (!jsonRpcClient) {
                    return grpcClient;
                }
                const featureFlags = ["dashboard_public_api_enabled", "centralizedPermissions"];
                if (featureFlagSuffix) {
                    featureFlags.push(`dashboard_public_api_${featureFlagSuffix}_enabled`);
                }
                // TODO(ak): is not going to work for getLoggedInUser itself
                const resolvedFlags = await Promise.all(
                    featureFlags.map((ff) =>
                        experimentsClient.getValueAsync(ff, false, {
                            user,
                            gitpodHost: window.location.host,
                        }),
                    ),
                );
                if (resolvedFlags.every((f) => f === true)) {
                    return grpcClient;
                }
                return jsonRpcClient;
            }
            /**
             * The original application error is retained using gRPC metadata to ensure that existing error handling remains intact.
             */
            function handleError(e: any): unknown {
                if (e instanceof ConnectError) {
                    throw converter.fromError(e);
                }
                throw e;
            }
            return (...args: any[]) => {
                const method = type.methods[prop as string];
                if (!method) {
                    throw new ConnectError("unimplemented", Code.Unimplemented);
                }

                // TODO(ak) default timeouts
                // TODO(ak) retry on unavailable?

                if (method.kind === MethodKind.Unary || method.kind === MethodKind.ClientStreaming) {
                    return (async () => {
                        try {
                            const client = await resolveClient();
                            const result = await Reflect.apply(client[prop as any], client, args);
                            return result;
                        } catch (e) {
                            handleError(e);
                        }
                    })();
                }
                return (async function* () {
                    try {
                        const client = await resolveClient();
                        const generator = Reflect.apply(client[prop as any], client, args) as AsyncGenerator<any>;
                        for await (const item of generator) {
                            yield item;
                        }
                    } catch (e) {
                        handleError(e);
                    }
                })();
            };
        },
    });
}

export function watchPrebuild(
    request: PartialMessage<WatchPrebuildRequest>,
    cb: (prebuild: Prebuild) => void,
): Disposable {
    return stream<WatchPrebuildResponse>(
        (options) => prebuildClient.watchPrebuild(request, options),
        (response) => cb(response.prebuild!),
    );
}

export function stream<Response>(
    factory: (options: CallOptions) => AsyncIterable<Response>,
    cb: (response: Response) => void,
): Disposable {
    const MAX_BACKOFF = 60000;
    const BASE_BACKOFF = 3000;
    let backoff = BASE_BACKOFF;
    const abort = new AbortController();
    (async () => {
        while (!abort.signal.aborted) {
            try {
                for await (const response of factory({
                    signal: abort.signal,
                })) {
                    backoff = BASE_BACKOFF;
                    cb(response);
                }
            } catch (e) {
                if (ApplicationError.hasErrorCode(e) && e.code === ErrorCodes.CANCELLED) {
                    return;
                }
                backoff = Math.min(2 * backoff, MAX_BACKOFF);
                console.error("failed to watch prebuild:", e);
            }
            const jitter = Math.random() * 0.3 * backoff;
            const delay = backoff + jitter;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    })();

    return Disposable.create(() => abort.abort());
}
