/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { ServiceImpl, HandlerContext } from "@connectrpc/connect";
import { WorkspaceRunnerService as WorkspaceRunnerServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/workspace_runner_connect";
import {
    ListRunnerWorkspacesRequest,
    ListRunnerWorkspacesResponse,
    RegisterRunnerRequest,
    RegisterRunnerResponse,
    RenewRunnerRegistrationRequest,
    RenewRunnerRegistrationResponse,
    UpdateRunnerWorkspaceStatusRequest,
    UpdateRunnerWorkspaceStatusResponse,
    WatchRunnerWorkspacesRequest,
    WatchRunnerWorkspacesResponse,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_runner_pb";
import {
    CommitContext,
    User,
    Workspace as DBWorkspace,
    WorkspaceInstance as DBWorkspaceInstance,
    WorkspaceContext as DBWorkspaceContext,
    SnapshotContext,
    WithPrebuild,
    AdditionalContentContext,
    GitCheckoutInfo,
    RefType,
} from "@gitpod/gitpod-protocol";
import { PartialMessage } from "@bufbuild/protobuf";
import {
    AdmissionLevel,
    GitInitializer,
    GitInitializer_AuthMethod,
    GitInitializer_CloneTargetMode,
    GitInitializer_GitConfig,
    SnapshotInitializer,
    Workspace,
    WorkspaceInitializer,
    WorkspaceInitializer_Spec,
    WorkspaceMetadata,
    WorkspacePhase_Phase,
    WorkspacePort,
    WorkspacePort_Protocol,
    WorkspaceSpec,
    WorkspaceSpec_GitSpec,
    WorkspaceSpec_Timeout,
    WorkspaceSpec_WorkspaceType,
} from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { HostContextProvider } from "../auth/host-context-provider";
import { EnvVarService } from "../user/env-var-service";
import { RedisPublisher, UserDB, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { generatePaginationToken } from "./pagination";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { ctxSignal, ctxUserId } from "../util/request-context";
import { UserService } from "../user/user-service";
import { EnvironmentVariable } from "@gitpod/public-api/lib/gitpod/v1/envvar_pb";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { TokenProvider } from "../user/token-provider";
import { generateAsyncGenerator } from "@gitpod/gitpod-protocol/lib/generate-async-generator";

@injectable()
export class WorkspaceRunnerServiceAPI implements ServiceImpl<typeof WorkspaceRunnerServiceInterface> {
    constructor(
        @inject(EnvVarService) private readonly envVarService: EnvVarService,
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,
        @inject(WorkspaceDB) private readonly workspaceDB: WorkspaceDB,
        @inject(UserDB) private readonly userDB: UserDB,
        @inject(UserService) private readonly userService: UserService,
        @inject(RedisPublisher) private readonly publisher: RedisPublisher,
        @inject(TokenProvider) private readonly tokenProvider: TokenProvider,
    ) {}

    // implement watchRunnerWorkspaces
    async *watchRunnerWorkspaces(req: WatchRunnerWorkspacesRequest): AsyncIterable<WatchRunnerWorkspacesResponse> {
        return generateAsyncGenerator<WatchRunnerWorkspacesResponse>(
            (sink) => {
                try {
                    const updateWatchTimeout = setTimeout(async () => {
                        const ws = await this.listRunnerWorkspaces(new ListRunnerWorkspacesRequest());
                        for (const w of ws.workspaces) {
                            sink.push(new WatchRunnerWorkspacesResponse({ workspace: w }));
                        }
                    }, 5000);
                    return () => {
                        clearTimeout(updateWatchTimeout);
                    };
                } catch (e) {
                    if (e instanceof Error) {
                        sink.fail(e);
                    } else {
                        sink.fail(new Error(String(e) || "unknown"));
                    }
                }
            },
            {
                signal: ctxSignal(),
            },
        );
    }

    async registerRunner(req: RegisterRunnerRequest): Promise<RegisterRunnerResponse> {
        return new RegisterRunnerResponse({
            clusterId: "local",
        });
    }

    async renewRunnerRegistration(req: RenewRunnerRegistrationRequest): Promise<RenewRunnerRegistrationResponse> {
        return new RenewRunnerRegistrationResponse();
    }

    async listRunnerWorkspaces(req: ListRunnerWorkspacesRequest): Promise<ListRunnerWorkspacesResponse> {
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
        return new ListRunnerWorkspacesResponse({
            workspaces: await Promise.all(
                ws.map((nfo) => this.convertWorkspaceSpec(user, nfo.workspace, nfo.latestInstance)),
            ),
            pagination: { nextToken: generatePaginationToken({ offset: 0 }) },
        });
    }

    async updateRunnerWorkspaceStatus(
        req: UpdateRunnerWorkspaceStatusRequest,
        _: HandlerContext,
    ): Promise<UpdateRunnerWorkspaceStatusResponse> {
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

        switch (req.update.case) {
            case "ack":
                const ack = req.update.value;
                // TODO(cw): find a more visible way to surface cluster acks
                log.debug({ instanceId: req.workspaceId, ack: ack, message: ack.message }, "cluster acked workspace");
                return new UpdateRunnerWorkspaceStatusResponse({});

            case "status":
                break;

            default:
                return new UpdateRunnerWorkspaceStatusResponse({});
        }

        const status = req.update.value;
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

        let lifecycleHandler: (() => Promise<void>) | undefined;
        switch (status.phase?.name) {
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

        return new UpdateRunnerWorkspaceStatusResponse({});
    }

    // convertWorkspaceSpec converts a single workspace into a GetRunnerWorkspacesResponse_WorkspaceSpec.
    // This is a fairly expensive operation, as it requires multiple DB queries and content service calls.
    private async convertWorkspaceSpec(user: User, ws: DBWorkspace, wsi: DBWorkspaceInstance): Promise<Workspace> {
        const metadata: PartialMessage<WorkspaceMetadata> = {
            ownerId: ws.ownerId,
            name: ws.description,
            pinned: ws.pinned,
            originalContextUrl: ws.contextURL,
        };
        if (ws.projectId) {
            metadata.configurationId = ws.projectId;
            metadata.organizationId = ws.organizationId;
        }

        const initializerPromise = this.createInitializer({}, ws, ws.context, user);
        // const userTimeoutPromise = this.entitlementService.getDefaultWorkspaceTimeout(user.id, ws.organizationId);
        // const workspaceLifetimePromise = this.entitlementService.getDefaultWorkspaceLifetime(
        //     user.id,
        //     ws.organizationId,
        // );

        const sshPublicKeys = (await this.userDB.getSSHPublicKeys(user.id)).map((k) => k.key);

        // TODO(cw): parse duration
        // const [defaultTimeout, workspaceLifetime] = await Promise.all([userTimeoutPromise, workspaceLifetimePromise]);
        // let userTimeout = defaultTimeout;
        // if (user.additionalData?.workspaceTimeout) {
        //     userTimeout = WorkspaceTimeoutDuration.validate(user.additionalData?.workspaceTimeout);
        // }
        const timeout: PartialMessage<WorkspaceSpec_Timeout> = {
            inactivity: { seconds: BigInt(60 * 60) },
            maximumLifetime: { seconds: BigInt(999) },
        };
        if (user.additionalData?.disabledClosedTimeout) {
            timeout.disconnected = { seconds: BigInt(0) };
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
                    admission: p.visibility === "public" ? AdmissionLevel.EVERYONE : AdmissionLevel.OWNER_ONLY,
                    protocol: p.protocol === "https" ? WorkspacePort_Protocol.HTTPS : WorkspacePort_Protocol.HTTP,
                });
            })
            .filter((spec) => !!spec) as WorkspacePort[];

        let type: WorkspaceSpec_WorkspaceType;
        if (ws.type === "prebuild") {
            type = WorkspaceSpec_WorkspaceType.PREBUILD;
        } else if (ws.type === "regular") {
            type = WorkspaceSpec_WorkspaceType.REGULAR;
        } else {
            throw new Error(`unsupported workspace type: ${ws.type}`);
        }

        const spec: PartialMessage<WorkspaceSpec> = {
            admission: ws.shareable ? AdmissionLevel.EVERYONE : AdmissionLevel.OWNER_ONLY,
            class: wsi.workspaceClass,
            git: await this.createGitSpec(user, ws),
            environmentVariables: await this.createEnvVars(user, ws),
            sshPublicKeys,
            timeout,
            ports,
            type,
            subassemblyReferences: [wsi.configuration.ideImage].concat(wsi.configuration.ideImageLayers || []),
            initializer: await initializerPromise,
        };

        return new Workspace({
            id: ws.id,
            metadata,
            spec,
        });
    }

    private createGitSpec(user: User, workspace: DBWorkspace): WorkspaceSpec_GitSpec {
        const context = workspace.context;
        if (!CommitContext.is(context)) {
            // this is not a commit context, thus we cannot produce a sensible GitSpec
            return new WorkspaceSpec_GitSpec();
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

        return new WorkspaceSpec_GitSpec({
            email: identity.primaryEmail!,
            username: user.fullName || identity.authName,
        });
    }

    private async createEnvVars(user: User, workspace: DBWorkspace): Promise<EnvironmentVariable[]> {
        const resolvedEnvVars = await this.envVarService.resolveEnvVariables(
            user.id,
            workspace.projectId,
            workspace.type,
            workspace.context,
        );

        const envvars = resolvedEnvVars.workspace.map(
            (ev) =>
                new EnvironmentVariable({
                    name: ev.name,
                    value: ev.value,
                }),
        );
        envvars.push(
            new EnvironmentVariable({
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

    public async createInitializer(
        traceCtx: TraceContext,
        workspace: DBWorkspace,
        context: DBWorkspaceContext,
        user: User,
    ): Promise<WorkspaceInitializer> {
        let initializers: WorkspaceInitializer_Spec[] = [];

        if (SnapshotContext.is(context)) {
            initializers.push(
                new WorkspaceInitializer_Spec({
                    spec: { case: "snapshot", value: new SnapshotInitializer({ snapshotId: context.snapshotId }) },
                }),
            );
        } else if (WithPrebuild.is(context)) {
            if (!CommitContext.is(context)) {
                throw new Error("context is not a commit context");
            }

            initializers.push(
                new WorkspaceInitializer_Spec({
                    spec: {
                        case: "snapshot",
                        value: new SnapshotInitializer({ snapshotId: context.snapshotBucketId }),
                    },
                }),
            );

            initializers = initializers.concat(
                initializers,
                (await this.createCommitInitializer(traceCtx, workspace, context, user)).map(
                    (i) => new WorkspaceInitializer_Spec({ spec: { case: "git", value: i } }),
                ),
            );
        } else if (CommitContext.is(context)) {
            initializers = initializers.concat(
                initializers,
                (await this.createCommitInitializer(traceCtx, workspace, context, user)).map(
                    (i) => new WorkspaceInitializer_Spec({ spec: { case: "git", value: i } }),
                ),
            );
        } else {
            throw new Error("cannot create initializer for unkown context type");
        }

        if (AdditionalContentContext.is(context)) {
            throw new Error("AdditionalContentContext is not supported yet");
        }
        return new WorkspaceInitializer({ specs: initializers });
    }

    private async createCommitInitializer(
        ctx: TraceContext,
        workspace: DBWorkspace,
        context: CommitContext,
        user: User,
    ): Promise<GitInitializer[]> {
        const span = TraceContext.startSpan("createInitializerForCommit", ctx);
        try {
            const mainGit = this.createGitInitializer({ span }, workspace, context, user);
            if (!context.additionalRepositoryCheckoutInfo || context.additionalRepositoryCheckoutInfo.length === 0) {
                return Promise.all([mainGit]);
            }
            const subRepoInitializers = [mainGit];
            for (const subRepo of context.additionalRepositoryCheckoutInfo) {
                subRepoInitializers.push(this.createGitInitializer({ span }, workspace, subRepo, user));
            }
            return await Promise.all(subRepoInitializers);
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    private async createGitInitializer(
        traceCtx: TraceContext,
        workspace: DBWorkspace,
        context: GitCheckoutInfo,
        user: User,
    ): Promise<GitInitializer> {
        const host = context.repository.host;
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext) {
            throw new Error(`Cannot authorize with host: ${host}`);
        }
        const authProviderId = hostContext.authProvider.authProviderId;
        const identity = user.identities.find((i) => i.authProviderId === authProviderId);
        if (!identity) {
            throw new Error("User is unauthorized!");
        }

        const cloneUrl = context.repository.cloneUrl;

        let cloneTarget: string | undefined;
        let targetMode: GitInitializer_CloneTargetMode;
        if (context.localBranch) {
            targetMode = GitInitializer_CloneTargetMode.LOCAL_BRANCH;
            cloneTarget = context.localBranch;
        } else if (RefType.getRefType(context) === "tag") {
            targetMode = GitInitializer_CloneTargetMode.REMOTE_COMMIT;
            cloneTarget = context.revision;
        } else if (context.ref) {
            targetMode = GitInitializer_CloneTargetMode.REMOTE_BRANCH;
            cloneTarget = context.ref;
        } else if (context.revision) {
            targetMode = GitInitializer_CloneTargetMode.REMOTE_COMMIT;
            cloneTarget = context.revision;
        } else {
            targetMode = GitInitializer_CloneTargetMode.REMOTE_HEAD;
        }

        const gitToken = await this.tokenProvider.getTokenForHost(user, host);
        if (!gitToken) {
            throw new Error(`No token for host: ${host}`);
        }
        const username = gitToken.username || "oauth2";

        const gitConfig = new GitInitializer_GitConfig({
            authentication: GitInitializer_AuthMethod.BASIC_AUTH,
            authUser: username,
            authPassword: gitToken.value,
            customConfig: workspace.config.gitConfig,
        });

        return new GitInitializer({
            checkoutLocation: context.checkoutLocation || context.repository.name,
            cloneTaget: cloneTarget,
            remoteUri: cloneUrl,
            targetMode,
            upstreamRemoteUri: context.upstreamRemoteURI,
            config: gitConfig,
        });
    }
}
