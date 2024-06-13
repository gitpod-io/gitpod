/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PartialMessage } from "@bufbuild/protobuf";
import { MethodKind, ServiceType } from "@bufbuild/protobuf";
import { CallOptions, Code, ConnectError, PromiseClient, createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { Disposable } from "@gitpod/gitpod-protocol";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { Project as ProtocolProject } from "@gitpod/gitpod-protocol/lib/teams-projects-protocol";
import { HelloService } from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_connect";
import { OIDCService } from "@gitpod/public-api/lib/gitpod/experimental/v1/oidc_connect";
import { ProjectsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/projects_connect";
import { Project } from "@gitpod/public-api/lib/gitpod/experimental/v1/projects_pb";
import { TokensService } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_connect";
import { OrganizationService } from "@gitpod/public-api/lib/gitpod/v1/organization_connect";
import { WorkspaceService } from "@gitpod/public-api/lib/gitpod/v1/workspace_connect";
import { ConfigurationService } from "@gitpod/public-api/lib/gitpod/v1/configuration_connect";
import { PrebuildService } from "@gitpod/public-api/lib/gitpod/v1/prebuild_connect";
import { getMetricsInterceptor } from "@gitpod/gitpod-protocol/lib/metrics";
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
import { UserService } from "@gitpod/public-api/lib/gitpod/v1/user_connect";
import { JsonRpcSSHClient } from "./json-rpc-ssh-client";
import { JsonRpcVerificationClient } from "./json-rpc-verification-client";
import { VerificationService } from "@gitpod/public-api/lib/gitpod/v1/verification_connect";
import { JsonRpcInstallationClient } from "./json-rpc-installation-client";
import { InstallationService } from "@gitpod/public-api/lib/gitpod/v1/installation_connect";
import { JsonRpcUserClient } from "./json-rpc-user-client";

const transport = createConnectTransport({
    baseUrl: `${window.location.protocol}//${window.location.host}/public-api`,
    interceptors: [getMetricsInterceptor()],
});

export const converter = new PublicAPIConverter();

export const helloService = createServiceClient(HelloService);
export const personalAccessTokensService = createPromiseClient(TokensService, transport);
/**
 * @deprecated use configurationClient instead
 */
export const projectsService = createPromiseClient(ProjectsService, transport);

export const oidcService = createPromiseClient(OIDCService, transport);

export const workspaceClient = createServiceClient(WorkspaceService, {
    client: new JsonRpcWorkspaceClient(),
    featureFlagSuffix: "workspace",
});
export const organizationClient = createServiceClient(OrganizationService, {
    client: new JsonRpcOrganizationClient(),
    featureFlagSuffix: "organization",
});

// No jsonrcp client for the configuration service as it's only used in new UI of the dashboard
export const configurationClient = createServiceClient(ConfigurationService);
export const prebuildClient = createServiceClient(PrebuildService, {
    client: new JsonRpcPrebuildClient(),
    featureFlagSuffix: "prebuild",
});

export const authProviderClient = createServiceClient(AuthProviderService, {
    client: new JsonRpcAuthProviderClient(),
    featureFlagSuffix: "authprovider",
});

export const scmClient = createServiceClient(SCMService, {
    client: new JsonRpcScmClient(),
    featureFlagSuffix: "scm",
});

export const envVarClient = createServiceClient(EnvironmentVariableService, {
    client: new JsonRpcEnvvarClient(),
    featureFlagSuffix: "envvar",
});

export const userClient = createServiceClient(UserService, {
    client: new JsonRpcUserClient(),
    featureFlagSuffix: "user",
});

export const sshClient = createServiceClient(SSHService, {
    client: new JsonRpcSSHClient(),
    featureFlagSuffix: "ssh",
});

export const verificationClient = createServiceClient(VerificationService, {
    client: new JsonRpcVerificationClient(),
    featureFlagSuffix: "verification",
});

export const installationClient = createServiceClient(InstallationService, {
    client: new JsonRpcInstallationClient(),
    featureFlagSuffix: "installation",
});

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

let user: { id: string; email?: string } | undefined;
export function updateUserForExperiments(newUser?: { id: string; email?: string }) {
    user = newUser;
}

function createServiceClient<T extends ServiceType>(
    type: T,
    jsonRpcOptions?: {
        client: PromiseClient<T>;
        featureFlagSuffix: string;
    },
): PromiseClient<T> {
    return new Proxy(createPromiseClient(type, transport), {
        get(grpcClient, prop) {
            const experimentsClient = getExperimentsClient();
            // TODO(ak) remove after migration
            async function resolveClient(): Promise<PromiseClient<T>> {
                if (!jsonRpcOptions) {
                    return grpcClient;
                }
                const featureFlags = [`dashboard_public_api_${jsonRpcOptions.featureFlagSuffix}_enabled`];
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
                return jsonRpcOptions.client;
            }
            return (...args: any[]) => {
                const requestContext = {
                    requestMethod: `${type.typeName}/${prop as string}`,
                };
                const callOptions: CallOptions = { ...args[1] };
                const originalOnHeader = callOptions.onHeader;
                callOptions.onHeader = (headers) => {
                    if (originalOnHeader) {
                        originalOnHeader(headers);
                    }
                    const requestId = headers.get("x-request-id") || undefined;
                    if (requestId) {
                        Object.assign(requestContext, { requestId });
                    }
                };
                args = [args[0], callOptions];

                function handleError(e: any): unknown {
                    if (e instanceof ConnectError) {
                        e = converter.fromError(e);
                    }

                    Object.assign(e, { requestContext });
                    throw e;
                }

                const method = type.methods[prop as string];
                if (!method) {
                    handleError(new ConnectError("unimplemented", Code.Unimplemented));
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
                    // GCP timeout is 10 minutes, we timeout 3 mins earlier
                    // to avoid unknown network errors and reconnect gracefully
                    timeoutMs: 7 * 60 * 1000,
                })) {
                    backoff = BASE_BACKOFF;
                    cb(response);
                }
            } catch (e) {
                if (abort.signal.aborted) {
                    // client aborted, don't reconnect, early exit
                    return;
                }
                if (
                    ApplicationError.hasErrorCode(e) &&
                    (e.code === ErrorCodes.DEADLINE_EXCEEDED ||
                        // library aborted: https://github.com/connectrpc/connect-es/issues/954
                        // (clean up when fixed, on server abort we should rather backoff with jitter)
                        e.code === ErrorCodes.CANCELLED)
                ) {
                    // timeout is expected, reconnect with base backoff
                    backoff = BASE_BACKOFF;
                } else {
                    backoff = Math.min(2 * backoff, MAX_BACKOFF);
                    console.error(e);
                }
            }
            const jitter = Math.random() * 0.3 * backoff;
            const delay = backoff + jitter;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    })();

    return Disposable.create(() => abort.abort());
}
