/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { ServiceImpl, HandlerContext } from "@connectrpc/connect";
import { ClusterService as ClusterServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/cluster_connect";
import {
    RegisterClusterRequest,
    RegisterClusterResponse,
    RenewClusterRegistrationRequest,
    RenewClusterRegistrationResponse,
    GetClusterWorkspacesRequest,
    GetClusterWorkspacesResponse,
    UpdateClusterWorkspaceStatusRequest,
    UpdateClusterWorkspaceStatusResponse,
    GetClusterWorkspacesResponse_WorkspaceSpec,
    GetClusterWorkspacesResponse_Workspace,
    GetClusterWorkspacesResponse_WorkspaceMetadata,
    GetClusterWorkspacesResponse_WorkspaceType,
    GetClusterWorkspacesResponse_GitSpec,
    GetClusterWorkspacesResponse_Timeout,
    UpdateClusterWorkspaceStatusRequest_WorkspaceConditionBool,
} from "@gitpod/public-api/lib/gitpod/v1/cluster_pb";
import { CommitContext, User, Workspace, WorkspaceInstance, WorkspaceTimeoutDuration } from "@gitpod/gitpod-protocol";
import { PartialMessage, Timestamp } from "@bufbuild/protobuf";
import {
    AdmissionLevel,
    WorkspacePhase_Phase,
    WorkspacePort,
    WorkspacePort_Policy,
    WorkspacePort_Protocol,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { HostContextProvider } from "../auth/host-context-provider";
import { ResolveWorkspaceEnvironmentVariablesResponse_EnvironmentVariable } from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { EnvVarService } from "../user/env-var-service";
import { RedisPublisher, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { EntitlementService } from "../billing/entitlement-service";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { WorkspaceStarter } from "../workspace/workspace-starter";
import { generatePaginationToken } from "./pagination";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ctxUserId } from "../util/request-context";
import { UserService } from "../user/user-service";

@injectable()
export class ClusterServiceAPI implements ServiceImpl<typeof ClusterServiceInterface> {
    constructor(
        @inject(EntitlementService) private readonly entitlementService: EntitlementService,
        @inject(EnvVarService) private readonly envVarService: EnvVarService,
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,
        @inject(WorkspaceStarter) private readonly workspaceStarter: WorkspaceStarter,
        @inject(WorkspaceDB) private readonly workspaceDB: WorkspaceDB,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(UserService) private readonly userService: UserService,
        @inject(RedisPublisher) private readonly publisher: RedisPublisher,
    ) {}

    async registerCluster(req: RegisterClusterRequest, _: HandlerContext): Promise<RegisterClusterResponse> {
        return new RegisterClusterResponse({
            registrationToken: "insert-real-token-here",
        });
    }

    async renewClusterRegistration(
        req: RenewClusterRegistrationRequest,
        _: HandlerContext,
    ): Promise<RenewClusterRegistrationResponse> {
        return new RenewClusterRegistrationResponse({
            registrationToken: "insert-real-token-here",
        });
    }

    async getClusterWorkspaces(
        req: GetClusterWorkspacesRequest,
        _: HandlerContext,
    ): Promise<GetClusterWorkspacesResponse> {
        const limit = req.pagination?.pageSize || 25;
        if (limit > 100) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "pageSize must be less than 100");
        }
        if (limit < 25) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "pageSize must be greater than 25");
        }
        // TODO(cw): actually handle pagination

        const user = await this.userService.findUserById(ctxUserId(), ctxUserId());
        const ws = await this.workspaceDB.findRunningInstancesWithWorkspaces("local", ctxUserId(), false);
        return new GetClusterWorkspacesResponse({
            workspaces: await Promise.all(
                ws.map((nfo) => this.convertWorkspaceSpec(user, nfo.workspace, nfo.latestInstance)),
            ),
            pagination: { nextToken: generatePaginationToken({ offset: 0 }) },
        });
    }

    async updateClusterWorkspaceStatus(
        req: UpdateClusterWorkspaceStatusRequest,
        _: HandlerContext,
    ): Promise<UpdateClusterWorkspaceStatusResponse> {
        const [ws, instance] = await Promise.all([
            this.workspaceDB.findById(req.workspaceId),
            this.workspaceDB.findRunningInstance(req.workspaceId),
        ]);
        if (!ws || !instance) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "workspace not found");
        }
        if (ws.ownerId !== ctxUserId()) {
            throw new ApplicationError(ErrorCodes.PERMISSION_DENIED, "not your workspace");
        }

        if (req.ack) {
            // TODO(cw): find a more visible way to surface cluster acks
            log.debug(
                { instanceId: req.workspaceId, ack: req.ack, message: req.ack.message },
                "cluster acked workspace",
            );
        }

        if (!req.status) {
            return new UpdateClusterWorkspaceStatusResponse({});
        }
        const status = req.status;
        if (!status.conditions) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "status.conditions is required");
        }

        if (!!instance.status.conditions.failed && !status.conditions.failed) {
            // We already have a "failed" condition, and received an empty one: This is a bug, "failed" conditions are terminal per definition.
            // Do not override!
            log.error('We received an empty "failed" condition overriding an existing one!', {
                current: instance.status.conditions.failed,
            });

            // TODO(gpl) To make ensure we do not break anything big time we keep the unconditional override for now, and observe for some time.
            instance.status.conditions.failed = status.conditions.failed;
        } else {
            instance.status.conditions.failed = status.conditions.failed;
        }
        instance.status.conditions.pullingImages = toBool(status.conditions.pullingImages!);
        instance.status.conditions.deployed = toBool(status.conditions.deployed);
        instance.status.conditions.timeout = status.conditions.timeout;
        instance.status.conditions.firstUserActivity = mapFirstUserActivity(status.conditions.firstUserActivity);
        instance.status.conditions.headlessTaskFailed = status.conditions.headlessTaskFailed;
        instance.status.conditions.stoppedByRequest = toBool(status.conditions.stoppedByRequest);
        instance.status.message = status.message;
        instance.status.ownerToken = status.ownerToken;

        let lifecycleHandler: (() => Promise<void>) | undefined;
        switch (status.phase) {
            case WorkspacePhase_Phase.PENDING:
                instance.status.phase = "pending";
                break;
            case WorkspacePhase_Phase.CREATING:
                instance.status.phase = "creating";
                break;
            case WorkspacePhase_Phase.INITIALIZING:
                instance.status.phase = "initializing";
                break;
            case WorkspacePhase_Phase.RUNNING:
                instance.status.phase = "running";
                // let's check if the state is inconsistent and be loud if it is.
                if (instance.stoppedTime || instance.stoppingTime) {
                    log.error("Resetting already stopped workspace to running.", {
                        instanceId: instance.id,
                        stoppedTime: instance.stoppedTime,
                    });
                    instance.stoppedTime = undefined;
                    instance.stoppingTime = undefined;
                }
                break;
            case WorkspacePhase_Phase.INTERRUPTED:
                instance.status.phase = "interrupted";
                break;
            case WorkspacePhase_Phase.STOPPING:
                if (instance.status.phase != "stopped") {
                    instance.status.phase = "stopping";
                    if (!instance.stoppingTime) {
                        // The first time a workspace enters stopping we record that as it's stoppingTime time.
                        // This way we don't take the time a workspace requires to stop into account when
                        // computing the time a workspace instance was running.
                        instance.stoppingTime = new Date().toISOString();
                    }
                } else {
                    log.warn({}, "Got a stopping event for an already stopped workspace.", instance);
                }
                break;
            case WorkspacePhase_Phase.STOPPED:
                const now = new Date().toISOString();
                instance.stoppedTime = now;
                instance.status.phase = "stopped";
                if (!instance.stoppingTime) {
                    // It's possible we've never seen a stopping update, hence have not set the `stoppingTime`
                    // yet. Just for this case we need to set it now.
                    instance.stoppingTime = now;
                }
                // lifecycleHandler = () => this.workspaceInstanceController.onStopped({ span }, userId, instance);
                break;
        }

        // // now notify all prebuild listeners about updates - and update DB if needed
        // await this.prebuildUpdater.updatePrebuiltWorkspace({ span }, userId, status);

        await this.workspaceDB.storeInstance(instance);

        // cleanup
        // important: call this after the DB update
        if (!!lifecycleHandler) {
            await lifecycleHandler();
        }
        await this.publisher.publishInstanceUpdate({
            ownerID: ws.ownerId,
            instanceID: instance.id,
            workspaceID: instance.workspaceId,
        });

        return new UpdateClusterWorkspaceStatusResponse({});
    }

    // convertWorkspaceSpec converts a single workspace into a GetClusterWorkspacesResponse_WorkspaceSpec.
    // This is a fairly expensive operation, as it requires multiple DB queries and content service calls.
    private async convertWorkspaceSpec(
        user: User,
        ws: Workspace,
        wsi: WorkspaceInstance,
    ): Promise<GetClusterWorkspacesResponse_Workspace> {
        const metadata: PartialMessage<GetClusterWorkspacesResponse_WorkspaceMetadata> = {
            owner: ws.ownerId,
            metaId: ws.id,
        };
        if (ws.projectId) {
            metadata.project = ws.projectId;
            metadata.team = ws.organizationId;
        }

        const initializerPromise = this.workspaceStarter.createInitializer({}, ws, ws.context, user, false);
        const userTimeoutPromise = this.entitlementService.getDefaultWorkspaceTimeout(user.id, ws.organizationId);
        const workspaceLifetimePromise = this.entitlementService.getDefaultWorkspaceLifetime(
            user.id,
            ws.organizationId,
        );

        const ideImageLayers = wsi.configuration.ideImageLayers! || [];
        ideImageLayers.push(wsi.configuration.ideImage);

        const sshPublicKeys = (await this.userDB.getSSHPublicKeys(user.id)).map((k) => k.key);

        const [defaultTimeout, workspaceLifetime] = await Promise.all([userTimeoutPromise, workspaceLifetimePromise]);
        let userTimeout = defaultTimeout;
        if (user.additionalData?.workspaceTimeout) {
            userTimeout = WorkspaceTimeoutDuration.validate(user.additionalData?.workspaceTimeout);
        }
        const timeout: PartialMessage<GetClusterWorkspacesResponse_Timeout> = {
            default: userTimeout,
            maximumLifetime: workspaceLifetime,
        };
        if (user.additionalData?.disabledClosedTimeout) {
            timeout.closed = "0s";
        }

        const portIndex = new Set<number>();
        const ports = (ws.config.ports || [])
            .map((p) => {
                if (portIndex.has(p.port)) {
                    log.debug(
                        { instanceId: wsi.id, workspaceId: ws.id, userId: user.id },
                        `duplicate port in user config: ${p.port}`,
                    );
                    return undefined;
                }
                portIndex.add(p.port);

                return new WorkspacePort({
                    port: BigInt(p.port),
                    policy: p.visibility === "public" ? WorkspacePort_Policy.PUBLIC : WorkspacePort_Policy.PRIVATE,
                    protocol: p.protocol === "https" ? WorkspacePort_Protocol.HTTPS : WorkspacePort_Protocol.HTTP,
                });
            })
            .filter((spec) => !!spec) as WorkspacePort[];

        const initializer = (await initializerPromise).initializer.serializeBinary();

        const spec: PartialMessage<GetClusterWorkspacesResponse_WorkspaceSpec> = {
            admission: ws.shareable ? AdmissionLevel.EVERYONE : AdmissionLevel.OWNER_ONLY,
            class: wsi.workspaceClass,
            git: await this.createGitSpec(user, ws),
            envvars: await this.createEnvVars(user, ws),
            ideImageLayers,
            sshPublicKeys,
            timeout,
            ports,
            initializer,
        };

        let type: GetClusterWorkspacesResponse_WorkspaceType;
        if (ws.type === "prebuild") {
            type = GetClusterWorkspacesResponse_WorkspaceType.PREBUILD;
        } else if (ws.type === "regular") {
            type = GetClusterWorkspacesResponse_WorkspaceType.REGULAR;
        } else {
            throw new Error(`unsupported workspace type: ${ws.type}`);
        }

        return new GetClusterWorkspacesResponse_Workspace({
            id: ws.id,
            metadata,
            spec,
            type,
        });
    }

    private createGitSpec(user: User, workspace: Workspace): GetClusterWorkspacesResponse_GitSpec {
        const context = workspace.context;
        if (!CommitContext.is(context)) {
            // this is not a commit context, thus we cannot produce a sensible GitSpec
            return new GetClusterWorkspacesResponse_GitSpec();
        }

        const host = context.repository.host;
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext) {
            throw new Error(`Cannot authorize with host: ${host}`);
        }
        const authProviderId = hostContext.authProvider.authProviderId;
        const identity = User.getIdentity(user, authProviderId);
        if (!identity) {
            throw new Error("User is unauthorized!");
        }

        return new GetClusterWorkspacesResponse_GitSpec({
            email: identity.primaryEmail!,
            username: user.fullName || identity.authName,
        });
    }

    private async createEnvVars(
        user: User,
        workspace: Workspace,
    ): Promise<ResolveWorkspaceEnvironmentVariablesResponse_EnvironmentVariable[]> {
        const resolvedEnvVars = await this.envVarService.resolveEnvVariables(
            user.id,
            workspace.projectId,
            workspace.type,
            workspace.context,
        );

        const envvars = resolvedEnvVars.workspace.map(
            (ev) =>
                new ResolveWorkspaceEnvironmentVariablesResponse_EnvironmentVariable({
                    name: ev.name,
                    value: ev.value,
                }),
        );
        envvars.push(
            new ResolveWorkspaceEnvironmentVariablesResponse_EnvironmentVariable({
                name: "GITPOD_WORKSPACE_CONTEXT_URL",
                value: workspace.context.normalizedContextURL || workspace.contextURL,
            }),
        );
        // TODO(cw): find a more explicit way to transport this
        // envvars.push(new ResolveWorkspaceEnvironmentVariablesResponse_EnvironmentVariable({
        //     name: "SUPERVISOR_DOTFILE_REPO",
        //     value: user.additionalData?.dotfileRepo || "",
        // }));

        return envvars;
    }
}

function toBool(b: UpdateClusterWorkspaceStatusRequest_WorkspaceConditionBool | undefined): boolean | undefined {
    if (b === UpdateClusterWorkspaceStatusRequest_WorkspaceConditionBool.UNSPECIFIED) {
        return;
    }

    return b === UpdateClusterWorkspaceStatusRequest_WorkspaceConditionBool.TRUE;
}

const mapFirstUserActivity = (firstUserActivity: Timestamp | undefined): string | undefined => {
    if (!firstUserActivity) {
        return undefined;
    }

    return firstUserActivity.toDate().toISOString();
};
