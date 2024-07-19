/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import {
    CloneTargetMode,
    FileDownloadInitializer,
    GitAuthMethod,
    GitConfig,
    GitInitializer,
    PrebuildInitializer,
    SnapshotInitializer,
    WorkspaceInitializer,
} from "@gitpod/content-service/lib";
import { CompositeInitializer, FromBackupInitializer } from "@gitpod/content-service/lib/initializer_pb";
import {
    DBWithTracing,
    ProjectDB,
    RedisPublisher,
    TracedUserDB,
    TracedWorkspaceDB,
    UserDB,
    WorkspaceDB,
} from "@gitpod/gitpod-db/lib";
import { BlockedRepositoryDB } from "@gitpod/gitpod-db/lib/blocked-repository-db";
import {
    AdditionalContentContext,
    BillingTier,
    CommitContext,
    Disposable,
    DisposableCollection,
    GitCheckoutInfo,
    GitpodServer,
    GitpodToken,
    GitpodTokenType,
    HeadlessWorkspaceEventType,
    IDESettings,
    ImageBuildLogInfo,
    ImageConfigFile,
    NamedWorkspaceFeatureFlag,
    Permission,
    Project,
    RefType,
    SnapshotContext,
    StartWorkspaceResult,
    TaskConfig,
    User,
    WithPrebuild,
    WithReferrerContext,
    Workspace,
    WorkspaceContext,
    WorkspaceImageSource,
    WorkspaceImageSourceDocker,
    WorkspaceImageSourceReference,
    WorkspaceInstance,
    WorkspaceInstanceConfiguration,
    WorkspaceInstancePhase,
    WorkspaceInstanceStatus,
    WorkspaceTimeoutDuration,
} from "@gitpod/gitpod-protocol";
import { IAnalyticsWriter, TrackMessage } from "@gitpod/gitpod-protocol/lib/analytics";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { LogContext, log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { WorkspaceRegion } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import * as IdeServiceApi from "@gitpod/ide-service-api/lib/ide.pb";
import {
    BuildRegistryAuth,
    BuildRegistryAuthSelective,
    BuildRegistryAuthTotal,
    BuildRequest,
    BuildResponse,
    BuildSource,
    BuildSourceDockerfile,
    BuildSourceReference,
    BuildStatus,
    ImageBuilderClientProvider,
    ResolveBaseImageRequest,
} from "@gitpod/image-builder/lib";
import {
    IDEImage,
    PromisifiedWorkspaceManagerClient,
    StartWorkspaceResponse,
    StartWorkspaceSpec,
    WorkspaceFeatureFlag,
} from "@gitpod/ws-manager/lib";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import {
    AdmissionLevel,
    EnvironmentVariable,
    GitSpec,
    PortSpec,
    PortVisibility,
    StartWorkspaceRequest,
    WorkspaceMetadata,
    WorkspaceType,
    PortProtocol,
    StopWorkspacePolicy,
    StopWorkspaceRequest,
    DescribeWorkspaceRequest,
} from "@gitpod/ws-manager/lib/core_pb";
import * as grpc from "@grpc/grpc-js";
import * as crypto from "crypto";
import { inject, injectable } from "inversify";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { HostContextProvider } from "../auth/host-context-provider";
import { ScopedResourceGuard } from "../auth/resource-access";
import { EntitlementService } from "../billing/entitlement-service";
import { Config } from "../config";
import { ExtendedIDESettings, IDEService } from "../ide-service";
import { OneTimeSecretServer } from "../one-time-secret-server";
import {
    FailedInstanceStartReason,
    increaseFailedInstanceStartCounter,
    increaseImageBuildsCompletedTotal,
    increaseImageBuildsStartedTotal,
    increaseSuccessfulInstanceStartCounter,
} from "../prometheus-metrics";
import { RedisMutex } from "../redis/mutex";
import { AuthorizationService } from "../user/authorization-service";
import { TokenProvider } from "../user/token-provider";
import { UserAuthentication } from "../user/user-authentication";
import { ImageSourceProvider } from "./image-source-provider";
import { WorkspaceClassesConfig } from "./workspace-classes";
import { SYSTEM_USER, SYSTEM_USER_ID } from "../authorization/authorizer";
import { EnvVarService, ResolvedEnvVars } from "../user/env-var-service";
import { RedlockAbortSignal } from "redlock";
import { ConfigProvider } from "./config-provider";
import { isGrpcError } from "@gitpod/gitpod-protocol/lib/util/grpc";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { ctxIsAborted, runWithRequestContext, runWithSubjectId } from "../util/request-context";
import { SubjectId } from "../auth/subject-id";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { IDESettingsVersion } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { getFeatureFlagEnableExperimentalJBTB } from "../util/featureflags";

export interface StartWorkspaceOptions extends Omit<GitpodServer.StartWorkspaceOptions, "ideSettings"> {
    excludeFeatureFlags?: NamedWorkspaceFeatureFlag[];
    ideSettings?: ExtendedIDESettings;
}

const MAX_INSTANCE_START_RETRIES = 2;
const INSTANCE_START_RETRY_INTERVAL_SECONDS = 2;
/** [mins] */
const SCM_TOKEN_LIFETIME_MINS = 30;

export async function getWorkspaceClassForInstance(
    ctx: TraceContext,
    workspace: Pick<Workspace, "type">,
    previousInstance: Pick<WorkspaceInstance, "workspaceClass"> | undefined,
    project: Project | undefined,
    workspaceClassOverride: string | undefined,
    config: WorkspaceClassesConfig,
): Promise<string> {
    const span = TraceContext.startSpan("getWorkspaceClassForInstance", ctx);
    try {
        let workspaceClass: string | undefined;
        if (workspaceClassOverride) {
            workspaceClass = workspaceClassOverride;
        }
        if (!workspaceClass && previousInstance) {
            workspaceClass = previousInstance.workspaceClass;
        }
        if (!workspaceClass) {
            switch (workspace.type) {
                case "prebuild":
                    if (project) {
                        const prebuildSettings = Project.getPrebuildSettings(project);
                        workspaceClass = prebuildSettings.workspaceClass;
                    }
                    break;
                case "regular":
                    workspaceClass = project?.settings?.workspaceClasses?.regular;
                    break;
            }
        }
        if (!workspaceClass) {
            workspaceClass = config.find((c) => !!c.isDefault)?.id;
        }
        return workspaceClass!;
    } finally {
        span.finish();
    }
}

class StartInstanceError extends Error {
    constructor(public readonly reason: FailedInstanceStartReason, public readonly cause: any) {
        super("Starting workspace instance failed: " + cause.message);
    }
}

export function isResourceExhaustedError(err: any): boolean {
    return "code" in err && err.code === grpc.status.RESOURCE_EXHAUSTED;
}

export function isClusterMaintenanceError(err: any): boolean {
    return (
        "code" in err &&
        err.code == grpc.status.FAILED_PRECONDITION &&
        "details" in err &&
        err.details == "under maintenance"
    );
}

@injectable()
export class WorkspaceStarter {
    static readonly STARTING_PHASES: WorkspaceInstancePhase[] = ["preparing", "building", "pending"];

    constructor(
        @inject(WorkspaceManagerClientProvider) private readonly clientProvider: WorkspaceManagerClientProvider,
        @inject(Config) private readonly config: Config,
        @inject(ConfigProvider) private readonly configProvider: ConfigProvider,
        @inject(IDEService) private readonly ideService: IDEService,
        @inject(TracedWorkspaceDB) private readonly workspaceDb: DBWithTracing<WorkspaceDB>,
        @inject(TracedUserDB) private readonly userDB: DBWithTracing<UserDB>,
        @inject(TokenProvider) private readonly tokenProvider: TokenProvider,
        @inject(HostContextProvider) private readonly hostContextProvider: HostContextProvider,
        @inject(AuthorizationService) private readonly authService: AuthorizationService,
        @inject(ImageBuilderClientProvider) private readonly imagebuilderClientProvider: ImageBuilderClientProvider,
        @inject(ImageSourceProvider) private readonly imageSourceProvider: ImageSourceProvider,
        @inject(UserAuthentication) private readonly userService: UserAuthentication,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
        @inject(OneTimeSecretServer) private readonly otsServer: OneTimeSecretServer,
        @inject(ProjectDB) private readonly projectDB: ProjectDB,
        @inject(BlockedRepositoryDB) private readonly blockedRepositoryDB: BlockedRepositoryDB,
        @inject(EntitlementService) private readonly entitlementService: EntitlementService,
        @inject(RedisMutex) private readonly redisMutex: RedisMutex,
        @inject(RedisPublisher) private readonly publisher: RedisPublisher,
        @inject(EnvVarService) private readonly envVarService: EnvVarService,
    ) {}

    public async startWorkspace(
        ctx: TraceContext,
        workspace: Workspace,
        user: User,
        project: Project | undefined,
        options: StartWorkspaceOptions,
    ): Promise<StartWorkspaceResult> {
        const span = TraceContext.startSpan("WorkspaceStarter.startWorkspace", ctx);
        span.setTag("workspaceId", workspace.id);

        if (workspace.projectId && workspace.type === "regular") {
            this.projectDB
                .updateProjectUsage(workspace.projectId, {
                    lastWorkspaceStart: new Date().toISOString(),
                })
                .catch((err) => log.error("cannot update project usage", err));
        }

        let instanceId: string | undefined = undefined;
        try {
            await this.checkBlockedRepository(user, workspace);

            // Some workspaces do not have an image source.
            // Workspaces without image source are not only legacy, but also happened due to what looks like a bug.
            // Whenever a such a workspace is re-started we'll give it an image source now. This is in line with how this thing used to work.
            //
            // At this point any workspace that has no imageSource should have a commit context (we don't have any other contexts which don't resolve
            // to a commit context prior to being started, or which don't get an imageSource).
            if (!workspace.imageSource) {
                const imageSource = await this.imageSourceProvider.getImageSource(
                    ctx,
                    user,
                    workspace.context as CommitContext,
                    workspace.config,
                );
                log.debug("Found workspace without imageSource, generated one", { imageSource });

                workspace.imageSource = imageSource;
                await this.workspaceDb.trace({ span }).store(workspace);
            }

            if (options.forceDefaultImage) {
                const res = await this.resolveBaseImage(
                    { span },
                    user,
                    this.config.workspaceDefaults.workspaceImage,
                    workspace,
                    undefined,
                    options.region,
                );
                workspace.imageSource = <WorkspaceImageSourceReference>{
                    baseImageResolved: res.getRef(),
                };
            }

            // check if there has been an instance before, i.e. if this is a restart
            const pastInstances = await this.workspaceDb.trace({ span }).findInstances(workspace.id);
            let lastValidWorkspaceInstance: WorkspaceInstance | undefined;
            // Sorted from latest to oldest
            for (const i of pastInstances.sort((a, b) => (a.creationTime > b.creationTime ? -1 : 1))) {
                // We're trying to figure out whether there was a successful backup or not, and if yes for which instance
                if (!!i.status.conditions && !i.status.conditions.failed) {
                    lastValidWorkspaceInstance = i;
                    break;
                }
            }

            let ideSettings = options.ideSettings;

            // if no explicit ideSettings are passed, we use the one from the last workspace instance
            if (lastValidWorkspaceInstance) {
                const ideConfig = lastValidWorkspaceInstance.configuration?.ideConfig;
                if (ideConfig?.ide) {
                    const enableExperimentalJBTB = await getFeatureFlagEnableExperimentalJBTB(user.id);
                    const preferToolbox = !enableExperimentalJBTB
                        ? false
                        : ideSettings?.preferToolbox ??
                          user.additionalData?.ideSettings?.preferToolbox ??
                          ideConfig.preferToolbox ??
                          false;
                    ideSettings = {
                        ...ideSettings,
                        defaultIde: ideConfig.ide,
                        useLatestVersion:
                            ideSettings?.useLatestVersion ??
                            user.additionalData?.ideSettings?.useLatestVersion ??
                            !!ideConfig.useLatest,
                        preferToolbox,
                    };
                }
            }
            const fromBackup = !!lastValidWorkspaceInstance?.id;
            const ideConfig = await this.resolveIDEConfiguration(ctx, workspace, user, ideSettings);
            // create an instance
            let instance = await this.newInstance(
                ctx,
                workspace,
                lastValidWorkspaceInstance,
                user,
                project,
                options.excludeFeatureFlags || [],
                ideConfig,
                fromBackup,
                options.region,
                options.workspaceClass,
            );
            // we run the actual creation of a new instance in a distributed lock, to make sure we always only start one instance per workspace.
            await this.redisMutex.using(["workspace-start-" + workspace.id], 2000, async () => {
                const runningInstance = await this.workspaceDb.trace({ span }).findRunningInstance(workspace.id);
                if (runningInstance) {
                    throw new Error(`Workspace ${workspace.id} is already running`);
                }
                instance = await this.workspaceDb.trace({ span }).storeInstance(instance);
            });
            span.log({ newInstance: instance.id });
            instanceId = instance.id;

            // start the instance
            await this.reconcileWorkspaceStart({ span }, instance.id, user, workspace);

            return { instanceID: instance.id };
        } catch (e) {
            this.logAndTraceStartWorkspaceError({ span }, { userId: user.id, instanceId }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    public async reconcileWorkspaceStart(_ctx: TraceContext, instanceId: string, user: User, workspace: Workspace) {
        const ctx = TraceContext.childContext("reconcileWorkspaceStart", _ctx);

        const doReconcileWorkspaceStart = async (abortSignal: RedlockAbortSignal) => {
            await runWithRequestContext(
                {
                    requestKind: "workspace-start",
                    requestMethod: "reconcileWorkspaceStart",
                    signal: abortSignal,
                    subjectId: SubjectId.fromUserId(user.id),
                },
                async () => {
                    try {
                        // Fetch a fresh instance to check it's phase
                        const instance = await this.workspaceDb.trace({}).findInstanceById(instanceId);
                        if (!instance) {
                            ctx.span.finish();
                            throw new Error("cannot find workspace for instance");
                        }
                        if (!WorkspaceStarter.STARTING_PHASES.includes(instance.status.phase)) {
                            log.debug(
                                { instanceId, workspaceId: instance.workspaceId, userId: user.id },
                                "can't start workspace instance in this phase",
                                { phase: instance.status.phase },
                            );
                            return;
                        }

                        const envVars = await this.envVarService.resolveEnvVariables(
                            user.id,
                            workspace.projectId,
                            workspace.type,
                            workspace.context,
                        );

                        await this.actuallyStartWorkspace(ctx, instance, workspace, user, envVars);
                    } catch (err) {
                        this.logAndTraceStartWorkspaceError(
                            ctx,
                            { userId: user.id, workspaceId: workspace.id, instanceId },
                            err,
                        );
                    } finally {
                        ctx.span.finish();
                    }
                },
            );
        };

        // We try to acquire a mutex here, which we intend to hold until the workspace start request is sent to ws-manager.
        // In case this container dies for whatever reason, the mutex is eventually released, and the instance can be picked up
        // by another server process (cmp. WorkspaceStartController).
        this.redisMutex
            .using(
                ["workspace-instance-start-" + instanceId],
                5000, // After 5s without extension the lock is released
                doReconcileWorkspaceStart,
                { retryCount: 4, retryDelay: 500 }, // We wait at most 2s until we give up, and conclude that someone else is already starting this instance
            )
            .catch((err) => {
                if (!RedisMutex.isLockedError(err)) {
                    log.warn({ instanceId }, "unexpected error during workspace instance start", err);
                }
            });
    }

    private async resolveIDEConfiguration(
        ctx: TraceContext,
        workspace: Workspace,
        user: User,
        userSelectedIdeSettings?: ExtendedIDESettings,
    ) {
        const span = TraceContext.startSpan("resolveIDEConfiguration", ctx);
        try {
            const migrated = this.ideService.migrateSettings(user);
            if (user.additionalData?.ideSettings && migrated) {
                user.additionalData.ideSettings = migrated;
            }

            const resp = await this.ideService.resolveWorkspaceConfig(workspace, user, userSelectedIdeSettings);
            if (!user.additionalData?.ideSettings && WithReferrerContext.is(workspace.context)) {
                // A user does not have IDE settings configured yet configure it with a referrer ide as default.
                const additionalData = user?.additionalData || {};
                const settings = additionalData.ideSettings || {};
                settings.settingVersion = IDESettingsVersion;
                settings.defaultIde = workspace.context.referrerIde;
                additionalData.ideSettings = settings;
                user.additionalData = additionalData;
                this.userDB
                    .trace(ctx)
                    .updateUserPartial(user)
                    .catch((e: Error) => {
                        log.error({ userId: user.id }, "cannot configure default desktop ide", e);
                    });
            }
            return resp;
        } finally {
            span.finish();
        }
    }

    public async stopWorkspaceInstance(
        ctx: TraceContext,
        instanceId: string,
        instanceRegion: string,
        reason: string,
        policy?: StopWorkspacePolicy,
    ): Promise<void> {
        const span = TraceContext.startSpan("stopWorkspaceInstance", ctx);
        span.setTag("stopWorkspaceReason", reason);
        log.info({ instanceId }, "Stopping workspace instance", { reason });

        const req = new StopWorkspaceRequest();
        req.setId(instanceId);
        req.setPolicy(policy || StopWorkspacePolicy.NORMALLY);

        let client: PromisifiedWorkspaceManagerClient | undefined;
        try {
            client = await this.clientProvider.get(instanceRegion);
        } catch (err) {
            log.error({ instanceId }, "cannot stop workspace instance", err);
            // we want to stop a workspace but the region doesn't exist. So we can assume it doesn't run anyymore and there will never be updates coming to bridge.
            // let's mark this workspace as stopped if it is not already stopped.
            const workspace = await this.workspaceDb.trace(ctx).findByInstanceId(instanceId);
            const instance = await this.workspaceDb.trace(ctx).findInstanceById(instanceId);
            if (workspace && instance && instance?.status.phase !== "stopped") {
                log.error(
                    { instanceId },
                    "Workspace instance is still running although the region doesn't exist anymore. Marking workspace as stopped.",
                );
                const updated = await this.workspaceDb.trace(ctx).updateInstancePartial(instanceId, {
                    status: {
                        phase: "stopped",
                        message: "Manually marked stopped, because workspace region does not exist anymore.",
                    },
                    stoppedTime: new Date().toISOString(),
                });
                await this.userDB.trace({ span }).deleteGitpodTokensNamedLike(workspace.ownerId, `${instance.id}-%`);
                await this.publisher.publishInstanceUpdate({
                    instanceID: updated.id,
                    ownerID: workspace.ownerId,
                    workspaceID: workspace.id,
                });
            }
            return;
        }
        await client.stopWorkspace(ctx, req);
    }

    private async checkBlockedRepository(user: User, { contextURL, organizationId }: Workspace) {
        const blockedRepository = await this.blockedRepositoryDB.findBlockedRepositoryByURL(contextURL);
        if (!blockedRepository) return;

        if (blockedRepository.blockUser) {
            try {
                await runWithSubjectId(SYSTEM_USER, async () =>
                    this.userService.blockUser(SYSTEM_USER_ID, user.id, true),
                );
                log.info({ userId: user.id }, "Blocked user.", { contextURL });
            } catch (error) {
                log.error({ userId: user.id }, "Failed to block user.", error, { contextURL });
            }
        }
        if (blockedRepository.blockFreeUsage) {
            const tier = await this.entitlementService.getBillingTier(user.id, organizationId);
            if (tier === "free") {
                throw new ApplicationError(
                    ErrorCodes.PRECONDITION_FAILED,
                    `${contextURL} requires a paid plan on Gitpod.`,
                );
            }
        }
        if (!blockedRepository.blockFreeUsage) {
            throw new ApplicationError(ErrorCodes.PRECONDITION_FAILED, `${contextURL} is blocklisted on Gitpod.`);
        }
    }

    // Note: this function does not expect to be awaited for by its caller. This means that it takes care of error handling itself.
    private async actuallyStartWorkspace(
        ctx: TraceContext,
        instance: WorkspaceInstance,
        workspace: Workspace,
        user: User,
        envVars: ResolvedEnvVars,
    ): Promise<void> {
        const span = TraceContext.startSpan("actuallyStartWorkspace", ctx);
        const region = instance.configuration.regionPreference;
        span.setTag("region_preference", region);
        const logCtx: LogContext = {
            instanceId: instance.id,
            userId: user.id,
            organizationId: workspace.organizationId,
            workspaceId: workspace.id,
        };
        const forceRebuild = !!workspace.context.forceImageBuild;
        log.info(logCtx, "Attempting to start workspace", {
            forceRebuild: forceRebuild,
        });

        // choose a cluster and start the instance
        let resp: StartWorkspaceResponse.AsObject | undefined = undefined;
        let startRequest: StartWorkspaceRequest;
        let retries = 0;
        let failReason: FailedInstanceStartReason = "other";
        try {
            if (instance.status.phase === "pending") {
                // due to the reconciliation loop we might have already started the workspace, especially in the "pending" phase
                const workspaceAlreadyExists = await this.existsWithWsManager(ctx, instance);
                if (workspaceAlreadyExists) {
                    log.debug(
                        { instanceId: instance.id, workspaceId: instance.workspaceId },
                        "workspace already exists, not starting again",
                        { phase: instance.status.phase },
                    );
                    return;
                }
            }

            // build workspace image
            const additionalAuth = await this.getAdditionalImageAuth(envVars);
            instance = await this.buildWorkspaceImage(
                { span },
                user,
                workspace,
                instance,
                additionalAuth,
                forceRebuild,
                forceRebuild,
                region,
            );

            // create spec
            const spec = await this.createSpec({ span }, user, workspace, instance, envVars);

            // create start workspace request
            const metadata = await this.createMetadata(workspace);
            startRequest = new StartWorkspaceRequest();
            startRequest.setId(instance.id);
            startRequest.setMetadata(metadata);
            startRequest.setType(workspace.type === "prebuild" ? WorkspaceType.PREBUILD : WorkspaceType.REGULAR);
            startRequest.setSpec(spec);
            startRequest.setServicePrefix(workspace.id);

            // try to start the workspace on a cluster
            failReason = "startOnClusterFailed";
            for (; retries < MAX_INSTANCE_START_RETRIES; retries++) {
                if (ctxIsAborted()) {
                    return;
                }
                resp = await this.tryStartOnCluster({ span }, startRequest, user, workspace, instance, region);
                if (resp) {
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, INSTANCE_START_RETRY_INTERVAL_SECONDS * 1000));
            }

            if (!resp) {
                const err = new Error("cannot start a workspace because no workspace clusters are available");
                await this.failInstanceStart({ span }, err, workspace, instance);
                throw new StartInstanceError("clusterSelectionFailed", err);
            }
            increaseSuccessfulInstanceStartCounter(retries);

            const trackProperties: TrackMessage["properties"] = {
                workspaceId: workspace.id,
                instanceId: instance.id,
                projectId: workspace.projectId,
                contextURL: workspace.contextURL,
                type: workspace.type,
                class: instance.workspaceClass,
                ideConfig: instance.configuration?.ideConfig,
                usesPrebuild: startRequest.getSpec()?.getInitializer()?.hasPrebuild(),
            };

            if (workspace.projectId && trackProperties.usesPrebuild && workspace.type === "regular") {
                const project = await this.projectDB.findProjectById(workspace.projectId);
                trackProperties.prebuildTriggerStrategy =
                    project?.settings?.prebuilds?.triggerStrategy ?? "webhook-based";
            }

            // update analytics
            this.analytics.track({
                userId: user.id,
                event: "workspace_started",
                properties: trackProperties,
                timestamp: new Date(instance.creationTime),
            });
        } catch (err) {
            if (isGrpcError(err) && err.code === grpc.status.ALREADY_EXISTS) {
                // This might happen because of timing: When we did the "workspaceAlreadyExists" check above, the DB state was not updated yet.
                // But when calling ws-manager to start the workspace, it was already present.
                //
                // By returning we skip the current cycle and wait for the next run of the workspace-start-controller.
                // This gives ws-manager(-bridge) some time to emit(/digest) updates.
                log.info(logCtx, "workspace already exists, waiting for ws-manager to push new state", err);
                return;
            }

            if (isGrpcError(err) && err.code === grpc.status.UNAVAILABLE) {
                // fall-through: we don't want to fail but retry/wait for future updates to resolve this
                log.warn(logCtx, "cannot start workspace instance due to temporary error", err);
                return;
            }

            if (ScmStartError.isScmStartError(err)) {
                // user does not have access to SCM
                await this.failInstanceStart({ span }, err, workspace, instance);
                err = new StartInstanceError("scmAccessFailed", err);
            }

            if (!(err instanceof StartInstanceError)) {
                // Serves as a catch-all for those cases that we have failed to map before
                if (isResourceExhaustedError(err)) {
                    failReason = "resourceExhausted";
                }
                if (isClusterMaintenanceError(err)) {
                    failReason = "workspaceClusterMaintenance";
                    err = new Error(
                        "We're in the middle of an update. We'll be back to normal soon. Please try again in a few minutes.",
                    );
                }
                await this.failInstanceStart({ span }, err, workspace, instance);
                err = new StartInstanceError(failReason, err);
            }

            this.logAndTraceStartWorkspaceError({ span }, logCtx, err);
        } finally {
            if (ctxIsAborted()) {
                ctx.span?.setTag("aborted", true);
            }
            span.finish();
        }
    }

    private logAndTraceStartWorkspaceError(ctx: TraceContext, logCtx: LogContext, err: any) {
        TraceContext.setError(ctx, err);

        let reason: FailedInstanceStartReason | undefined = undefined;
        if (err instanceof StartInstanceError) {
            reason = err.reason;
            increaseFailedInstanceStartCounter(reason);
        }
        log.error(logCtx, "error starting instance", err, {
            failedInstanceStartReason: reason,
        });
        ctx.span?.setTag("failedInstanceStartReason", reason);
    }

    private async createMetadata(workspace: Workspace): Promise<WorkspaceMetadata> {
        const metadata = new WorkspaceMetadata();
        metadata.setOwner(workspace.ownerId);
        metadata.setMetaId(workspace.id);
        if (workspace.projectId) {
            metadata.setProject(workspace.projectId);
            metadata.setTeam(workspace.organizationId);
        }

        return metadata;
    }

    private async tryStartOnCluster(
        ctx: TraceContext,
        startRequest: StartWorkspaceRequest,
        user: User,
        workspace: Workspace,
        instance: WorkspaceInstance,
        region?: WorkspaceRegion,
    ): Promise<StartWorkspaceResponse.AsObject | undefined> {
        const constrainOnWorkspaceClassSupport = await isWorkspaceClassDiscoveryEnabled(user);

        let lastInstallation = "";
        const clusters = await this.clientProvider.getStartClusterSets(
            user,
            workspace,
            instance,
            region,
            constrainOnWorkspaceClassSupport,
        );
        for await (const cluster of clusters) {
            if (ctxIsAborted()) {
                return;
            }
            try {
                // getStartManager will throw an exception if there's no cluster available and hence exit the loop
                const { manager, installation } = cluster;
                lastInstallation = installation;

                instance.status.phase = "pending";
                instance.region = installation;
                await this.workspaceDb.trace(ctx).storeInstance(instance);
                try {
                    await this.publisher.publishInstanceUpdate({
                        instanceID: instance.id,
                        ownerID: workspace.ownerId,
                        workspaceID: workspace.id,
                    });
                } catch (err) {
                    // if sending the notification fails that's no reason to stop the workspace creation.
                    // If the dashboard misses this event it will catch up at the next one.
                    ctx.span?.log({ "notifyOnInstanceUpdate.error": err });
                    log.debug("cannot send instance update - this should be mostly inconsequential", err);
                }

                // start that thing
                log.info({ instanceId: instance.id }, "starting instance");
                return (await manager.startWorkspace(ctx, startRequest)).toObject();
            } catch (err: any) {
                if (isResourceExhaustedError(err)) {
                    throw err;
                } else if (isClusterMaintenanceError(err)) {
                    throw err;
                } else if (isGrpcError(err) && err.code === grpc.status.ALREADY_EXISTS) {
                    throw err;
                } else if ("code" in err && err.code !== grpc.status.OK && lastInstallation !== "") {
                    log.error({ instanceId: instance.id }, "cannot start workspace on cluster, might retry", err, {
                        cluster: lastInstallation,
                    });
                } else {
                    throw err;
                }
            }
        }

        return undefined;
    }

    private async getAdditionalImageAuth(envVars: ResolvedEnvVars): Promise<Map<string, string>> {
        const res = new Map<string, string>();
        const imageAuth = envVars.project.find((e) => e.name === "GITPOD_IMAGE_AUTH");
        if (!imageAuth) {
            return res;
        }

        const imageAuthValue = (await this.projectDB.getProjectEnvironmentVariableValues([imageAuth]))[0];

        (imageAuthValue.value || "")
            .split(",")
            .map((e) => e.trim().split(":"))
            .filter((e) => e.length == 2)
            .forEach((e) => res.set(e[0], e[1]));
        return res;
    }

    /**
     * failInstanceStart properly fails a workspace instance if something goes wrong before the instance ever reaches
     * workspace manager. In this case we need to make sure we also fulfil the tasks of the bridge (e.g. for prebulds).
     */
    private async failInstanceStart(ctx: TraceContext, err: any, workspace: Workspace, instance: WorkspaceInstance) {
        if (ctxIsAborted()) {
            return;
        }

        const span = TraceContext.startSpan("failInstanceStart", ctx);
        try {
            // We may have never actually started the workspace which means that ws-manager-bridge never set a workspace status.
            // We have to set that status ourselves.
            instance.status.phase = "stopped";
            const now = new Date().toISOString();
            instance.stoppingTime = now;
            instance.stoppedTime = now;

            instance.status.conditions.failed = err.toString();
            instance.status.message = `Workspace cannot be started: ${err}`;
            await this.workspaceDb.trace({ span }).storeInstance(instance);
            await this.publisher.publishInstanceUpdate({
                instanceID: instance.id,
                ownerID: workspace.ownerId,
                workspaceID: workspace.id,
            });

            // If we just attempted to start a workspace for a prebuild - and that failed, we have to fail the prebuild itself.
            await this.failPrebuildWorkspace({ span }, err, workspace);
        } catch (err) {
            TraceContext.setError({ span }, err);
            log.error(
                { workspaceId: workspace.id, instanceId: instance.id, userId: workspace.ownerId },
                "cannot properly fail workspace instance during start",
                err,
            );
        } finally {
            span.finish();
        }
    }

    private async failPrebuildWorkspace(ctx: TraceContext, err: any, workspace: Workspace) {
        const span = TraceContext.startSpan("failInstanceStart", ctx);
        try {
            if (workspace.type === "prebuild") {
                const prebuild = await this.workspaceDb.trace({ span }).findPrebuildByWorkspaceID(workspace.id);
                if (prebuild && prebuild.state !== "failed") {
                    prebuild.state = "failed";
                    prebuild.error = err.toString();

                    await this.workspaceDb.trace({ span }).storePrebuiltWorkspace(prebuild);
                    await this.publisher.publishHeadlessUpdate({
                        type: HeadlessWorkspaceEventType.Failed,
                        workspaceID: workspace.id,
                    });
                }
            }
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    /**
     * Creates a new instance for a given workspace and its owner
     *
     * @param workspace the workspace to create an instance for
     */
    private async newInstance(
        ctx: TraceContext,
        workspace: Workspace,
        previousInstance: WorkspaceInstance | undefined,
        user: User,
        project: Project | undefined,
        excludeFeatureFlags: NamedWorkspaceFeatureFlag[],
        ideConfig: IdeServiceApi.ResolveWorkspaceConfigResponse,
        fromBackup: boolean,
        regionPreference: WorkspaceRegion | undefined,
        workspaceClassOverride?: string,
    ): Promise<WorkspaceInstance> {
        const span = TraceContext.startSpan("newInstance", ctx);
        try {
            let ideTasks: TaskConfig[] = [];
            try {
                if (ideConfig.tasks && ideConfig.tasks.trim() !== "") {
                    ideTasks = JSON.parse(ideConfig.tasks);
                }
            } catch (e) {
                log.info({ workspaceId: workspace.id }, "failed parse tasks from ide config:", e, {
                    tasks: ideConfig.tasks,
                });
            }

            const configuration: WorkspaceInstanceConfiguration = {
                ideImage: ideConfig.webImage,
                ideImageLayers: ideConfig.ideImageLayers,
                supervisorImage: ideConfig.supervisorImage,
                ideConfig: {
                    // We only check user setting because if code(insider) but desktopIde has no latestImage
                    // it still need to notice user that this workspace is using latest IDE
                    useLatest: user.additionalData?.ideSettings?.useLatestVersion,
                },
                ideSetup: {
                    envvars: ideConfig.envvars,
                    tasks: ideTasks,
                },
                regionPreference,
                fromBackup,
            };
            if (ideConfig.ideSettings && ideConfig.ideSettings.trim() !== "") {
                try {
                    const enableExperimentalJBTB = await getFeatureFlagEnableExperimentalJBTB(user.id);
                    const ideSettings: IDESettings = JSON.parse(ideConfig.ideSettings);
                    configuration.ideConfig!.ide = ideSettings.defaultIde;
                    configuration.ideConfig!.useLatest = !!ideSettings.useLatestVersion;
                    configuration.ideConfig!.preferToolbox = !enableExperimentalJBTB
                        ? false
                        : ideSettings.preferToolbox ?? false;
                } catch (error) {
                    log.error({ userId: user.id, workspaceId: workspace.id }, "cannot parse ideSettings", error);
                }
            }

            const billingTier = await this.entitlementService.getBillingTier(user.id, workspace.organizationId);

            let featureFlags: NamedWorkspaceFeatureFlag[] = workspace.config._featureFlags || [];
            featureFlags = featureFlags.concat(this.config.workspaceDefaults.defaultFeatureFlags);
            if (user.featureFlags && user.featureFlags.permanentWSFeatureFlags) {
                // Workspace-persisted feature flags are inherited from and controlled by workspace.config._featureFlags
                // Make sure we do not overide them, here.
                const nonWorkspacePersistentFeatureFlags = user.featureFlags.permanentWSFeatureFlags.filter(
                    (ff) => !NamedWorkspaceFeatureFlag.isWorkspacePersisted(ff),
                );
                featureFlags = featureFlags.concat(featureFlags, nonWorkspacePersistentFeatureFlags);
            }

            // if the user has feature preview enabled, we need to add the respective feature flags.
            // Beware: all feature flags we add here are not workspace-persistent feature flags, e.g. no full-workspace backup.
            if (!!user.additionalData?.featurePreview) {
                featureFlags = featureFlags.concat(
                    this.config.workspaceDefaults.previewFeatureFlags.filter((f) => !featureFlags.includes(f)),
                );
            }

            featureFlags = featureFlags.filter((f) => !excludeFeatureFlags.includes(f));

            if (await this.shouldEnableConnectionLimiting(user.id, workspace.organizationId)) {
                featureFlags.push("workspace_connection_limiting");
            }

            if (this.shouldEnablePSI(billingTier)) {
                featureFlags.push("workspace_psi");
            }

            if (await this.shouldEnableSSHCA(user, workspace.organizationId)) {
                featureFlags.push("ssh_ca");
            }

            const workspaceClass = await getWorkspaceClassForInstance(
                ctx,
                workspace,
                previousInstance,
                project,
                workspaceClassOverride,
                this.config.workspaceClasses,
            );

            featureFlags = featureFlags.concat(["workspace_class_limiting"]);

            if (!!featureFlags) {
                // only set feature flags if there actually are any. Otherwise we waste the
                // few bytes of JSON in the database for no good reason.
                configuration.featureFlags = featureFlags;
            }

            const usageAttributionId = AttributionId.createFromOrganizationId(workspace.organizationId);
            const now = new Date().toISOString();
            const instance: WorkspaceInstance = {
                id: uuidv4(),
                workspaceId: workspace.id,
                creationTime: now,
                ideUrl: "", // Initially empty, filled during starting process
                region: this.config.installationShortname, // Shortname set to bridge can cleanup workspaces stuck preparing
                workspaceImage: "", // Initially empty, filled during starting process
                status: {
                    version: 0,
                    conditions: {},
                    phase: "preparing",
                },
                gitStatus: previousInstance?.gitStatus,
                configuration,
                usageAttributionId: usageAttributionId && AttributionId.render(usageAttributionId),
                workspaceClass,
            };

            if (WithReferrerContext.is(workspace.context)) {
                this.analytics.track({
                    userId: user.id,
                    event: "ide_referrer",
                    properties: {
                        workspaceId: workspace.id,
                        instanceId: instance.id,
                        referrer: workspace.context.referrer,
                        referrerIde: workspace.context.referrerIde,
                    },
                });
            }
            return instance;
        } finally {
            span.finish();
        }
    }

    private async shouldEnableConnectionLimiting(userId: string, organizationId: string): Promise<boolean> {
        return this.entitlementService.limitNetworkConnections(userId, organizationId);
    }

    private async shouldEnableSSHCA(user: User, organizationId: string): Promise<boolean> {
        return getExperimentsClientForBackend().getValueAsync("isSSHCertificateAuthoritiesEnabled", false, {
            user: user,
            teamId: organizationId,
        });
    }

    private shouldEnablePSI(billingTier: BillingTier): boolean {
        return billingTier === "paid";
    }

    private async prepareBuildRequest(
        ctx: TraceContext,
        workspace: Workspace,
        imgsrc: WorkspaceImageSource,
        user: User,
        additionalAuth: Map<string, string>,
    ): Promise<{ src: BuildSource; auth: BuildRegistryAuth; disposable?: Disposable }> {
        const span = TraceContext.startSpan("prepareBuildRequest", ctx);

        try {
            const auth = new BuildRegistryAuth();
            const userHasRegistryAccess = this.authService.hasPermission(user, Permission.REGISTRY_ACCESS);
            if (userHasRegistryAccess) {
                const totalAuth = new BuildRegistryAuthTotal();
                totalAuth.setAllowAll(userHasRegistryAccess);
                auth.setTotal(totalAuth);
            } else {
                const selectiveAuth = new BuildRegistryAuthSelective();
                selectiveAuth.setAnyOfList(this.config.defaultBaseImageRegistryWhitelist);
                auth.setSelective(selectiveAuth);
            }
            additionalAuth.forEach((val, key) => auth.getAdditionalMap().set(key, val));
            if (WorkspaceImageSourceDocker.is(imgsrc)) {
                let source: WorkspaceInitializer;
                const disp = new DisposableCollection();
                let checkoutLocation =
                    (CommitContext.is(workspace.context) && workspace.context.checkoutLocation) || ".";
                if (
                    !AdditionalContentContext.hasDockerConfig(workspace.context, workspace.config) &&
                    imgsrc.dockerFileSource
                ) {
                    // TODO(se): we cannot change this initializer structure now because it is part of how baserefs are computed in image-builder.
                    // Image builds should however just use the initialization if the workspace they are running for (i.e. the one from above).
                    checkoutLocation = ".";
                    const { initializer } = await this.createCommitInitializer(
                        { span },
                        workspace,
                        {
                            ...imgsrc.dockerFileSource,
                            checkoutLocation,
                            title: "irrelevant",
                            ref: undefined,
                        },
                        user,
                    );
                    let git: GitInitializer;
                    if (initializer instanceof CompositeInitializer) {
                        // we use the first git initializer for image builds only
                        git = initializer.getInitializerList()[0].getGit()!;
                    } else {
                        git = initializer;
                    }
                    git.setCloneTaget(imgsrc.dockerFileSource.revision);
                    git.setTargetMode(CloneTargetMode.REMOTE_COMMIT);
                    source = new WorkspaceInitializer();
                    source.setGit(git);
                } else {
                    const { initializer, disposable } = await this.createInitializer(
                        { span },
                        workspace,
                        workspace.context,
                        user,
                        false,
                    );
                    source = initializer;
                    disp.push(disposable);
                }

                const context = (workspace.config.image as ImageConfigFile).context;
                const contextPath = !!context ? path.join(checkoutLocation, context) : checkoutLocation;
                const dockerFilePath = path.join(checkoutLocation, imgsrc.dockerFilePath);

                const file = new BuildSourceDockerfile();
                file.setContextPath(contextPath);
                file.setDockerfilePath(dockerFilePath);
                file.setSource(source);
                file.setDockerfileVersion(imgsrc.dockerFileHash);

                const src = new BuildSource();
                src.setFile(file);
                return { src, auth, disposable: disp };
            }
            if (WorkspaceImageSourceReference.is(imgsrc)) {
                const ref = new BuildSourceReference();
                ref.setRef(imgsrc.baseImageResolved);

                const src = new BuildSource();
                src.setRef(ref);
                return { src, auth };
            }

            throw new Error("unknown workspace image source");
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    private async buildWorkspaceImage(
        ctx: TraceContext,
        user: User,
        workspace: Workspace,
        instance: WorkspaceInstance,
        additionalAuth: Map<string, string>,
        ignoreBaseImageresolvedAndRebuildBase: boolean = false,
        forceRebuild: boolean = false,
        region?: WorkspaceRegion,
    ): Promise<WorkspaceInstance> {
        const span = TraceContext.startSpan("buildWorkspaceImage", ctx);

        try {
            // Start build...
            const client = await this.getImageBuilderClient(user, workspace, instance, region);
            const { src, auth, disposable } = await this.prepareBuildRequest(
                { span },
                workspace,
                workspace.imageSource!,
                user,
                additionalAuth,
            );

            const req = new BuildRequest();
            req.setSource(src);
            req.setAuth(auth);
            req.setForceRebuild(forceRebuild);
            req.setTriggeredBy(user.id);
            if (!ignoreBaseImageresolvedAndRebuildBase && !forceRebuild && workspace.baseImageNameResolved) {
                req.setBaseImageNameResolved(workspace.baseImageNameResolved);
            }
            const supervisorImage = instance.configuration?.supervisorImage;
            if (supervisorImage) {
                req.setSupervisorRef(supervisorImage);
            }

            // Make sure we persist logInfo as soon as we retrieve it
            const imageBuildLogInfo = new Deferred<ImageBuildLogInfo>();
            imageBuildLogInfo.promise
                .then(async (logInfo) => {
                    const imageBuildInfo = {
                        ...(instance.imageBuildInfo || {}),
                        log: logInfo,
                    };
                    instance.imageBuildInfo = imageBuildInfo; // make sure we're not overriding ourselves again
                    await this.workspaceDb
                        .trace({ span })
                        .updateInstancePartial(instance.id, { imageBuildInfo })
                        .catch((err) => log.error("error writing image build log info to the DB", err));
                })
                .catch((err) =>
                    // TODO (gpl) This error happens quite often, but looks like it's mostly triggered by user errors:
                    // The image build fails (e.g. bc the base image cannot be pulled) so fast that we never received the log meta info.
                    // We switch this to "debug" for now. Going forward, we should:
                    //  1. turn this into a metric to feat the "image build reliability" SLI
                    //  2. fix the image-builder implementation
                    log.debug("image build: never received log info", err, {
                        instanceId: instance.id,
                        workspaceId: instance.workspaceId,
                    }),
                );

            const result = await client.build({ span }, req, imageBuildLogInfo);

            if (result.actuallyNeedsBuild) {
                instance.status.conditions = {
                    ...instance.status.conditions,
                    neededImageBuild: true,
                }; // Stored below
                ctx.span?.setTag("needsImageBuild", true);
                increaseImageBuildsStartedTotal();
            }

            // Update the workspace now that we know what the name of the workspace image will be (which doubles as buildID)
            workspace.imageNameResolved = result.ref;
            span.log({ ref: workspace.imageNameResolved });
            await this.workspaceDb.trace({ span }).store(workspace);

            // Update workspace instance to tell the world we're building an image
            const workspaceImage = result.ref;
            const status: WorkspaceInstanceStatus = result.actuallyNeedsBuild
                ? { ...instance.status, phase: "building" }
                : instance.status;
            instance = await this.workspaceDb
                .trace({ span })
                .updateInstancePartial(instance.id, { workspaceImage, status });
            await this.publisher.publishInstanceUpdate({
                instanceID: instance.id,
                ownerID: workspace.ownerId,
                workspaceID: workspace.id,
            });

            let buildResult: BuildResponse;
            try {
                // ...and wait for the build to finish
                buildResult = await result.buildPromise;
                if (buildResult.getStatus() == BuildStatus.DONE_FAILURE) {
                    throw new Error(buildResult.getMessage());
                }
            } catch (err) {
                if (
                    err &&
                    err.message &&
                    err.message.includes("base image does not exist") &&
                    !ignoreBaseImageresolvedAndRebuildBase
                ) {
                    // we've attempted to add the base layer for a workspace whoose base image has gone missing.
                    // Ignore the previously built (now missing) base image and force a rebuild.
                    return this.buildWorkspaceImage(
                        ctx,
                        user,
                        workspace,
                        instance,
                        additionalAuth,
                        true,
                        forceRebuild,
                        region,
                    );
                } else {
                    throw err;
                }
            } finally {
                // clean any created one time secrets, so they don't hang around unnecessarily
                if (!!disposable) {
                    disposable.dispose();
                }
            }

            // Register a successful image build only if the image actually needed to be built; ie the build was not a no-op.
            if (result.actuallyNeedsBuild) {
                increaseImageBuildsCompletedTotal("succeeded");
            }

            // We have just found out how our base image is called - remember that.
            // Note: it's intentional that we overwrite existing baseImageNameResolved values here so that one by one the refs here become absolute (i.e. digested form).
            //       This prevents the "rebuilds" for old workspaces.
            if (!!buildResult.getBaseRef() && buildResult.getBaseRef() != workspace.baseImageNameResolved) {
                span.log({ oldBaseRef: workspace.baseImageNameResolved, newBaseRef: buildResult.getBaseRef() });

                workspace.baseImageNameResolved = buildResult.getBaseRef();
                await this.workspaceDb.trace({ span }).store(workspace);
            }

            return instance;
        } catch (err) {
            // Notify error
            let message = "Error building image!";
            if (err && err.message) {
                message = err.message;
            }

            // This instance's image build "failed" as well, so mark it as such.
            await this.failInstanceStart({ span }, err, workspace, instance);

            const looksLikeUserError = (msg: string): boolean => {
                return (
                    msg.startsWith("build failed:") ||
                    msg.includes("headless task failed:") ||
                    msg.includes("cannot resolve image")
                );
            };
            if (looksLikeUserError(message)) {
                log.info(
                    { instanceId: instance.id, userId: user.id, workspaceId: workspace.id },
                    `workspace image build failed: ${message}`,
                    { looksLikeUserError: true },
                );
                err = new StartInstanceError("imageBuildFailedUser", err);
                // Don't report this as "failed" to our metrics as it would trigger an alert
            } else {
                log.error(
                    { instanceId: instance.id, userId: user.id, workspaceId: workspace.id },
                    `workspace image build failed: ${message}`,
                );
                err = new StartInstanceError("imageBuildFailed", err);
                increaseImageBuildsCompletedTotal("failed");
            }
            this.analytics.track({
                userId: user.id,
                event: "imagebuild-failed",
                properties: { workspaceId: workspace.id, instanceId: instance.id, contextURL: workspace.contextURL },
            });

            throw err;
        } finally {
            span.finish();
        }
    }

    private async createSpec(
        traceCtx: TraceContext,
        user: User,
        workspace: Workspace,
        instance: WorkspaceInstance,
        envVars: ResolvedEnvVars,
    ): Promise<StartWorkspaceSpec> {
        const context = workspace.context;

        // TODO(cw): for the time being we're still pushing the env vars as we did before.
        //           Once everything is running with the latest supervisor, we can stop doing that.
        const envvars = envVars.workspace.map((e) => {
            const ev = new EnvironmentVariable();
            ev.setName(e.name);
            ev.setValue(e.value);
            return ev;
        });

        const contextUrlEnv = new EnvironmentVariable();
        contextUrlEnv.setName("GITPOD_WORKSPACE_CONTEXT_URL");
        // Beware that `workspace.contextURL` is not normalized so it might contain other modifiers
        // making it not a valid URL
        contextUrlEnv.setValue(workspace.context.normalizedContextURL || workspace.contextURL);
        envvars.push(contextUrlEnv);

        const contextEnv = new EnvironmentVariable();
        contextEnv.setName("GITPOD_WORKSPACE_CONTEXT");
        contextEnv.setValue(JSON.stringify(workspace.context));
        envvars.push(contextEnv);

        const info = this.config.workspaceClasses.find((cls) => cls.id === instance.workspaceClass);
        if (!!info) {
            const workspaceClassInfoEnv = new EnvironmentVariable();
            workspaceClassInfoEnv.setName("GITPOD_WORKSPACE_CLASS_INFO");
            workspaceClassInfoEnv.setValue(JSON.stringify(info));
            envvars.push(workspaceClassInfoEnv);
        }

        log.debug("Workspace config", workspace.config);

        const tasks = resolveGitpodTasks(workspace, instance);
        if (tasks.length) {
            // The task config is interpreted by supervisor only, there's little point in transforming it into something
            // wsman understands and back into the very same structure.
            const ev = new EnvironmentVariable();
            ev.setName("GITPOD_TASKS");
            ev.setValue(JSON.stringify(tasks));
            envvars.push(ev);
        }

        const vsxRegistryUrl = new EnvironmentVariable();
        vsxRegistryUrl.setName("VSX_REGISTRY_URL");
        vsxRegistryUrl.setValue(this.config.vsxRegistryUrl);
        envvars.push(vsxRegistryUrl);

        // supervisor ensures dotfiles are only used if the workspace is a regular workspace
        const dotfileEnv = new EnvironmentVariable();
        dotfileEnv.setName("SUPERVISOR_DOTFILE_REPO");
        dotfileEnv.setValue(user.additionalData?.dotfileRepo || "");
        envvars.push(dotfileEnv);

        if (workspace.config.coreDump?.enabled) {
            // default core dump size is 262144 blocks (if blocksize is 4096)
            const defaultLimit: number = 1073741824;

            const rLimitCore = new EnvironmentVariable();
            rLimitCore.setName("GITPOD_RLIMIT_CORE");
            rLimitCore.setValue(
                JSON.stringify({
                    softLimit: workspace.config.coreDump?.softLimit || defaultLimit,
                    hardLimit: workspace.config.coreDump?.hardLimit || defaultLimit,
                }),
            );
            envvars.push(rLimitCore);
        }

        const createGitpodTokenPromise = (async () => {
            const scopes = this.createDefaultGitpodAPITokenScopes(workspace, instance);
            const token = crypto.randomBytes(30).toString("hex");
            const tokenHash = crypto.createHash("sha256").update(token, "utf8").digest("hex");
            const dbToken: GitpodToken = {
                tokenHash,
                name: `${instance.id}-default`,
                type: GitpodTokenType.MACHINE_AUTH_TOKEN,
                userId: user.id,
                scopes,
                created: new Date().toISOString(),
            };
            await this.userDB.trace(traceCtx).storeGitpodToken(dbToken);

            const tokenExpirationTime = new Date();
            tokenExpirationTime.setMinutes(tokenExpirationTime.getMinutes() + 24 * 60);

            const ev = new EnvironmentVariable();
            ev.setName("THEIA_SUPERVISOR_TOKENS");
            ev.setValue(
                JSON.stringify([
                    {
                        token: token,
                        kind: "gitpod",
                        host: this.config.hostUrl.url.host,
                        scope: scopes,
                        expiryDate: tokenExpirationTime.toISOString(),
                        reuse: 2,
                    },
                ]),
            );
            envvars.push(ev);
        })();

        const portIndex = new Set<number>();
        const ports = (workspace.config.ports || [])
            .map((p) => {
                if (portIndex.has(p.port)) {
                    log.debug(
                        { instanceId: instance.id, workspaceId: workspace.id, userId: user.id },
                        `duplicate port in user config: ${p.port}`,
                    );
                    return undefined;
                }
                portIndex.add(p.port);

                const spec = new PortSpec();
                spec.setPort(p.port);
                spec.setVisibility(
                    p.visibility == "public"
                        ? PortVisibility.PORT_VISIBILITY_PUBLIC
                        : PortVisibility.PORT_VISIBILITY_PRIVATE,
                );
                spec.setProtocol(
                    p.protocol == "https" ? PortProtocol.PORT_PROTOCOL_HTTPS : PortProtocol.PORT_PROTOCOL_HTTP,
                );
                return spec;
            })
            .filter((spec) => !!spec) as PortSpec[];

        let admissionLevel: AdmissionLevel;
        if (workspace.shareable) {
            admissionLevel = AdmissionLevel.ADMIT_EVERYONE;
        } else {
            admissionLevel = AdmissionLevel.ADMIT_OWNER_ONLY;
        }

        let checkoutLocation = workspace.config.checkoutLocation;
        if (!checkoutLocation) {
            if (CommitContext.is(context)) {
                checkoutLocation = context.repository.name;
            } else {
                checkoutLocation = ".";
            }
        }

        const initializerPromise = this.createInitializer(
            traceCtx,
            workspace,
            workspace.context,
            user,
            instance.configuration.fromBackup || false,
        );
        const userTimeoutPromise = this.entitlementService.getDefaultWorkspaceTimeout(
            user.id,
            workspace.organizationId,
        );
        const allowSetTimeoutPromise = this.entitlementService.maySetTimeout(user.id, workspace.organizationId);
        const workspaceLifetimePromise = this.entitlementService.getDefaultWorkspaceLifetime(
            user.id,
            workspace.organizationId,
        );

        const featureFlags = instance.configuration!.featureFlags || [];

        const sysEnvvars: EnvironmentVariable[] = [];
        const ideEnvVars = instance.configuration.ideSetup?.envvars || [];
        for (const e of ideEnvVars) {
            const ev = new EnvironmentVariable();
            ev.setName(e.name);
            ev.setValue(e.value);
            sysEnvvars.push(ev);
        }

        const orgIdEnv = new EnvironmentVariable();
        orgIdEnv.setName("GITPOD_DEFAULT_WORKSPACE_IMAGE");
        orgIdEnv.setValue(await this.configProvider.getDefaultImage(workspace.organizationId));
        sysEnvvars.push(orgIdEnv);

        const client = getExperimentsClientForBackend();
        const [isSetJavaXmx, isSetJavaProcessorCount] = await Promise.all([
            client
                .getValueAsync("supervisor_set_java_xmx", false, { user })
                .then((v) => newEnvVar("GITPOD_IS_SET_JAVA_XMX", String(v))),
            client
                .getValueAsync("supervisor_set_java_processor_count", false, { user })
                .then((v) => newEnvVar("GITPOD_IS_SET_JAVA_PROCESSOR_COUNT", String(v))),
        ]);
        sysEnvvars.push(isSetJavaXmx);
        sysEnvvars.push(isSetJavaProcessorCount);
        const spec = new StartWorkspaceSpec();
        await createGitpodTokenPromise;
        spec.setEnvvarsList(envvars);
        spec.setSysEnvvarsList(sysEnvvars);
        spec.setGit(this.createGitSpec(workspace, user));
        spec.setPortsList(ports);
        spec.setInitializer((await initializerPromise).initializer);
        const startWorkspaceSpecIDEImage = new IDEImage();
        startWorkspaceSpecIDEImage.setWebRef(instance.configuration.ideImage);
        startWorkspaceSpecIDEImage.setSupervisorRef(instance.configuration.supervisorImage || ""); // set for all new instances
        spec.setIdeImage(startWorkspaceSpecIDEImage);
        spec.setIdeImageLayersList(instance.configuration.ideImageLayers!);
        spec.setWorkspaceImage(instance.workspaceImage);
        spec.setWorkspaceLocation(workspace.config.workspaceLocation || checkoutLocation);
        spec.setFeatureFlagsList(this.toWorkspaceFeatureFlags(featureFlags));
        spec.setClass(instance.workspaceClass!);

        if (workspace.type === "regular") {
            const [defaultTimeout, allowSetTimeout, workspaceLifetime] = await Promise.all([
                userTimeoutPromise,
                allowSetTimeoutPromise,
                workspaceLifetimePromise,
            ]);
            spec.setTimeout(defaultTimeout);
            spec.setMaximumLifetime(workspaceLifetime);
            if (allowSetTimeout) {
                if (user.additionalData?.workspaceTimeout) {
                    try {
                        const timeout = WorkspaceTimeoutDuration.validate(user.additionalData?.workspaceTimeout);
                        spec.setTimeout(timeout);
                    } catch (err) {}
                }

                // if the user has set a timeout, then disabledClosedTimeout would be true
                if (user.additionalData?.disabledClosedTimeout === true) {
                    /*
                     * If disabledClosedTimeout is true, it indicates that the user wishes to prevent the workspace
                     * from being automatically "stopped" or terminated due to inactivity.
                     * By setting the closed timeout to "0", we effectively disable this automatic termination feature,
                     * ensuring that the workspace remains active until it explicitly hits the workspace timeout limits,
                     * if any are set. This provides users with greater control over their workspace's lifecycle,
                     * accommodating scenarios where extended activity periods are necessary.
                     */
                    spec.setClosedTimeout("0");
                }
            }
        }
        spec.setAdmission(admissionLevel);
        const sshKeys = await this.userDB.trace(traceCtx).getSSHPublicKeys(user.id);
        spec.setSshPublicKeysList(sshKeys.map((e) => e.key));
        return spec;
    }

    private createDefaultGitpodAPITokenScopes(workspace: Workspace, instance: WorkspaceInstance): string[] {
        const scopes = [
            "function:getWorkspace",
            "function:getLoggedInUser",
            "function:getWorkspaceOwner",
            "function:getWorkspaceUsers",
            "function:isWorkspaceOwner",
            "function:controlAdmission",
            "function:setWorkspaceTimeout",
            "function:getWorkspaceTimeout",
            "function:sendHeartBeat",
            "function:getOpenPorts",
            "function:openPort",
            "function:closePort",
            "function:generateNewGitpodToken",
            "function:takeSnapshot",
            "function:waitForSnapshot",
            "function:stopWorkspace",
            "function:getToken",
            "function:getGitpodTokenScopes",
            "function:accessCodeSyncStorage",
            "function:guessGitTokenScopes",
            "function:updateGitStatus",
            "function:getWorkspaceEnvVars",
            "function:getEnvVars", // TODO remove this after new gitpod-cli is deployed
            "function:setEnvVar",
            "function:deleteEnvVar",
            "function:getTeams",
            "function:trackEvent",
            "function:getSupportedWorkspaceClasses",
            // getIDToken is used by Gitpod's OIDC Identity Provider to check for authorisation.
            // Without this scope the workspace cannot produce ID tokens.
            "function:getIDToken",
            "function:getDefaultWorkspaceImage",

            "resource:" +
                ScopedResourceGuard.marshalResourceScope({
                    kind: "workspace",
                    subjectID: workspace.id,
                    operations: ["get", "update"],
                }),
            "resource:" +
                ScopedResourceGuard.marshalResourceScope({
                    kind: "workspaceInstance",
                    subjectID: instance.id,
                    operations: ["get", "update", "delete"],
                }),
            "resource:" +
                ScopedResourceGuard.marshalResourceScope({
                    kind: "snapshot",
                    subjectID: ScopedResourceGuard.SNAPSHOT_WORKSPACE_SUBJECT_ID_PREFIX + workspace.id,
                    operations: ["create"],
                }),
            "resource:" +
                ScopedResourceGuard.marshalResourceScope({
                    kind: "gitpodToken",
                    subjectID: "*",
                    operations: ["create"],
                }),
            "resource:" +
                ScopedResourceGuard.marshalResourceScope({
                    kind: "userStorage",
                    subjectID: "*",
                    operations: ["create", "get", "update"],
                }),
            "resource:" +
                ScopedResourceGuard.marshalResourceScope({ kind: "token", subjectID: "*", operations: ["get"] }),
            "resource:" +
                ScopedResourceGuard.marshalResourceScope({
                    kind: "contentBlob",
                    subjectID: "*",
                    operations: ["create", "get"],
                }),
        ];
        if (CommitContext.is(workspace.context)) {
            const subjectID = workspace.context.repository.owner + "/" + workspace.context.repository.name;
            scopes.push(
                "resource:" +
                    ScopedResourceGuard.marshalResourceScope({
                        kind: "envVar",
                        subjectID,
                        operations: ["create", "get", "update", "delete"],
                    }),
            );
        }
        return scopes;
    }

    private createGitSpec(workspace: Workspace, user: User): GitSpec {
        const context = workspace.context;
        if (!CommitContext.is(context)) {
            // this is not a commit context, thus we cannot produce a sensible GitSpec
            return new GitSpec();
        }

        const host = context.repository.host;
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext) {
            throw new ScmStartError(host, `Cannot authorize with host`);
        }
        const authProviderId = hostContext.authProvider.authProviderId;
        const identity = User.getIdentity(user, authProviderId);
        if (!identity) {
            throw new ScmStartError(host, "User not connected with host");
        }

        const gitSpec = new GitSpec();
        gitSpec.setUsername(user.fullName || identity.authName);
        gitSpec.setEmail(identity.primaryEmail!);
        return gitSpec;
    }

    private async createInitializer(
        traceCtx: TraceContext,
        workspace: Workspace,
        context: WorkspaceContext,
        user: User,
        fromBackup: boolean,
    ): Promise<{ initializer: WorkspaceInitializer; disposable: Disposable }> {
        let result = new WorkspaceInitializer();
        const disp = new DisposableCollection();

        if (fromBackup) {
            const backup = new FromBackupInitializer();
            if (CommitContext.is(context)) {
                backup.setCheckoutLocation(context.checkoutLocation || "");
            }
            result.setBackup(backup);
        } else if (SnapshotContext.is(context)) {
            const snapshot = new SnapshotInitializer();
            snapshot.setSnapshot(context.snapshotBucketId);
            result.setSnapshot(snapshot);
        } else if (WithPrebuild.is(context)) {
            if (!CommitContext.is(context)) {
                throw new Error("context is not a commit context");
            }

            const snapshot = new SnapshotInitializer();
            snapshot.setSnapshot(context.snapshotBucketId);
            const { initializer } = await this.createCommitInitializer(traceCtx, workspace, context, user);
            const init = new PrebuildInitializer();
            init.setPrebuild(snapshot);
            if (initializer instanceof CompositeInitializer) {
                for (const myInit of initializer.getInitializerList()) {
                    if (myInit instanceof WorkspaceInitializer && myInit.hasGit()) {
                        init.addGit(myInit.getGit());
                    }
                }
            } else {
                init.addGit(initializer);
            }
            result.setPrebuild(init);
        } else if (CommitContext.is(context)) {
            const { initializer } = await this.createCommitInitializer(traceCtx, workspace, context, user);
            if (initializer instanceof CompositeInitializer) {
                result.setComposite(initializer);
            } else {
                result.setGit(initializer);
            }
        } else {
            throw new Error("cannot create initializer for unknown context type");
        }
        if (AdditionalContentContext.is(context)) {
            const additionalInit = new FileDownloadInitializer();

            const getDigest = (contents: string) => {
                return "sha256:" + crypto.createHash("sha256").update(contents).digest("hex");
            };

            const tokenExpirationTime = new Date();
            tokenExpirationTime.setMinutes(tokenExpirationTime.getMinutes() + 30);
            const fileInfos = await Promise.all(
                Object.entries(context.additionalFiles).map(async ([filePath, content]) => {
                    const url = await this.otsServer.serve(traceCtx, content, tokenExpirationTime);
                    const finfo = new FileDownloadInitializer.FileInfo();
                    finfo.setUrl(url.url);
                    finfo.setFilePath(filePath);
                    finfo.setDigest(getDigest(content));
                    return finfo;
                }),
            );

            additionalInit.setFilesList(fileInfos);
            if (CommitContext.is(context)) {
                additionalInit.setTargetLocation(context.checkoutLocation || context.repository.name);
            }

            // wire the protobuf structure
            const composite = new CompositeInitializer();
            const newRoot = new WorkspaceInitializer();
            newRoot.setComposite(composite);
            composite.addInitializer(result);
            const wsInitializerForDownload = new WorkspaceInitializer();
            wsInitializerForDownload.setDownload(additionalInit);
            composite.addInitializer(wsInitializerForDownload);
            result = newRoot;
        }
        return { initializer: result, disposable: disp };
    }

    private async createCommitInitializer(
        ctx: TraceContext,
        workspace: Workspace,
        context: CommitContext,
        user: User,
    ): Promise<{ initializer: GitInitializer | CompositeInitializer }> {
        const span = TraceContext.startSpan("createInitializerForCommit", ctx);
        try {
            const mainGit = this.createGitInitializer({ span }, workspace, context, user);
            if (!context.additionalRepositoryCheckoutInfo || context.additionalRepositoryCheckoutInfo.length === 0) {
                return mainGit;
            }
            const subRepoInitializers = [mainGit];
            for (const subRepo of context.additionalRepositoryCheckoutInfo) {
                subRepoInitializers.push(this.createGitInitializer({ span }, workspace, subRepo, user));
            }
            const inits = await Promise.all(subRepoInitializers);
            const compositeInit = new CompositeInitializer();
            for (const r of inits) {
                const wsinit = new WorkspaceInitializer();
                wsinit.setGit(r.initializer);
                compositeInit.addInitializer(wsinit);
            }
            return {
                initializer: compositeInit,
            };
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    private async createGitInitializer(
        traceCtx: TraceContext,
        workspace: Workspace,
        context: GitCheckoutInfo,
        user: User,
    ): Promise<{ initializer: GitInitializer }> {
        const host = context.repository.host;
        const hostContext = this.hostContextProvider.get(host);
        if (!hostContext) {
            throw new ScmStartError(host, `Cannot authorize with host`);
        }
        const authProviderId = hostContext.authProvider.authProviderId;
        const identity = user.identities.find((i) => i.authProviderId === authProviderId);
        if (!identity) {
            throw new ScmStartError(host, "User not connected with host");
        }

        const cloneUrl = context.repository.cloneUrl;

        let cloneTarget: string | undefined;
        let targetMode: CloneTargetMode;
        if (context.localBranch) {
            targetMode = CloneTargetMode.LOCAL_BRANCH;
            cloneTarget = context.localBranch;
        } else if (RefType.getRefType(context) === "tag") {
            targetMode = CloneTargetMode.REMOTE_COMMIT;
            cloneTarget = context.revision;
        } else if (context.ref) {
            targetMode = CloneTargetMode.REMOTE_BRANCH;
            cloneTarget = context.ref;
        } else if (context.revision) {
            targetMode = CloneTargetMode.REMOTE_COMMIT;
            cloneTarget = context.revision;
        } else {
            targetMode = CloneTargetMode.REMOTE_HEAD;
        }

        const gitToken = await this.tokenProvider.getTokenForHost(user, host, SCM_TOKEN_LIFETIME_MINS);
        if (!gitToken) {
            throw new Error(`No token for host: ${host}`);
        }
        const username = gitToken.username || "oauth2";

        const gitConfig = new GitConfig();
        gitConfig.setAuthentication(GitAuthMethod.BASIC_AUTH);
        gitConfig.setAuthUser(username);
        gitConfig.setAuthPassword(gitToken.value);

        const userGitConfig = workspace.config.gitConfig;
        if (!!userGitConfig) {
            Object.keys(userGitConfig)
                .filter((k) => userGitConfig.hasOwnProperty(k))
                .forEach((k) => gitConfig.getCustomConfigMap().set(k, userGitConfig[k]));
        }

        const result = new GitInitializer();
        result.setConfig(gitConfig);
        result.setCheckoutLocation(context.checkoutLocation || context.repository.name);
        if (!!cloneTarget) {
            result.setCloneTaget(cloneTarget);
        }
        result.setRemoteUri(cloneUrl);
        result.setTargetMode(targetMode);
        if (!!context.upstreamRemoteURI) {
            result.setUpstreamRemoteUri(context.upstreamRemoteURI);
        }

        return {
            initializer: result,
        };
    }

    private toWorkspaceFeatureFlags(featureFlags: NamedWorkspaceFeatureFlag[]): WorkspaceFeatureFlag[] {
        const result = featureFlags
            .map((name) => {
                for (const key in WorkspaceFeatureFlag) {
                    if (key === name.toUpperCase()) {
                        return WorkspaceFeatureFlag[key] as any as WorkspaceFeatureFlag;
                    }
                }
                log.debug(`not a valid workspace feature flag: ${name}`);
                return undefined;
            })
            .filter((f) => !!f) as WorkspaceFeatureFlag[];

        return result;
    }

    /**
     * @param user
     * @param workspace
     * @param instance
     * @param region
     * @returns
     */
    private async getImageBuilderClient(
        user: User,
        workspace?: Workspace,
        instance?: WorkspaceInstance,
        region?: WorkspaceRegion,
    ) {
        return this.imagebuilderClientProvider.getClient(user, workspace, instance, region);
    }

    public async resolveBaseImage(
        ctx: TraceContext,
        user: User,
        imageRef: string,
        workspace?: Workspace,
        instance?: WorkspaceInstance,
        region?: WorkspaceRegion,
    ) {
        const req = new ResolveBaseImageRequest();
        req.setRef(imageRef);
        const allowAll = new BuildRegistryAuthTotal();
        allowAll.setAllowAll(true);
        const auth = new BuildRegistryAuth();
        auth.setTotal(allowAll);
        req.setAuth(auth);
        const client = await this.getImageBuilderClient(user, workspace, instance, region);
        return client.resolveBaseImage({ span: ctx.span }, req);
    }

    private async existsWithWsManager(ctx: TraceContext, instance: WorkspaceInstance): Promise<boolean> {
        try {
            const req = new DescribeWorkspaceRequest();
            req.setId(instance.id);

            const client = await this.clientProvider.get(instance.region);
            await client.describeWorkspace(ctx, req);
            return true;
        } catch (err) {
            if (isClusterMaintenanceError(err)) {
                throw err;
            }
            return false;
        }
    }
}

function resolveGitpodTasks(ws: Workspace, instance: WorkspaceInstance): TaskConfig[] {
    const tasks: TaskConfig[] = [];
    if (ws.config.tasks) {
        tasks.push(...ws.config.tasks);
    }
    if (instance.configuration.ideSetup?.tasks) {
        tasks.push(...instance.configuration.ideSetup.tasks);
    }
    return tasks;
}

export async function isWorkspaceClassDiscoveryEnabled(user: { id: string }): Promise<boolean> {
    return getExperimentsClientForBackend().getValueAsync("workspace_class_discovery_enabled", false, {
        user: user,
    });
}

export class ScmStartError extends Error {
    constructor(public readonly host: string, msg: string) {
        super(`${host}: ` + msg);
    }

    static isScmStartError(o: any): o is ScmStartError {
        return !!o && o["host"];
    }
}

function newEnvVar(key: string, value: string): EnvironmentVariable {
    const env = new EnvironmentVariable();
    env.setName(key);
    env.setValue(value);
    return env;
}
