/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
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
    DBUser,
    DBWithTracing,
    ProjectDB,
    TeamDB,
    TracedUserDB,
    TracedWorkspaceDB,
    UserDB,
    WorkspaceDB,
} from "@gitpod/gitpod-db/lib";
import { BlockedRepositoryDB } from "@gitpod/gitpod-db/lib/blocked-repository-db";
import {
    CommitContext,
    Disposable,
    GitpodToken,
    GitpodTokenType,
    GitCheckoutInfo,
    NamedWorkspaceFeatureFlag,
    RefType,
    SnapshotContext,
    StartWorkspaceResult,
    User,
    UserEnvVar,
    UserEnvVarValue,
    WithEnvvarsContext,
    WithPrebuild,
    Workspace,
    WorkspaceContext,
    WorkspaceImageSource,
    WorkspaceImageSourceDocker,
    WorkspaceImageSourceReference,
    WorkspaceInstance,
    WorkspaceInstanceConfiguration,
    WorkspaceInstanceStatus,
    Permission,
    HeadlessWorkspaceEventType,
    DisposableCollection,
    AdditionalContentContext,
    ImageConfigFile,
    ProjectEnvVar,
    ImageBuildLogInfo,
    IDESettings,
    WithReferrerContext,
    EnvVarWithValue,
    BillingTier,
} from "@gitpod/gitpod-protocol";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
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
    ResolveWorkspaceImageRequest,
} from "@gitpod/image-builder/lib";
import { StartWorkspaceSpec, WorkspaceFeatureFlag, StartWorkspaceResponse, IDEImage } from "@gitpod/ws-manager/lib";
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
    VolumeSnapshotInfo,
    StopWorkspacePolicy,
    StopWorkspaceRequest,
} from "@gitpod/ws-manager/lib/core_pb";
import * as crypto from "crypto";
import { inject, injectable } from "inversify";
import { v4 as uuidv4 } from "uuid";
import { HostContextProvider } from "../auth/host-context-provider";
import { ScopedResourceGuard } from "../auth/resource-access";
import { Config } from "../config";
import { OneTimeSecretServer } from "../one-time-secret-server";
import { AuthorizationService } from "../user/authorization-service";
import { TokenProvider } from "../user/token-provider";
import { UserService } from "../user/user-service";
import { ImageSourceProvider } from "./image-source-provider";
import { MessageBusIntegration } from "./messagebus-integration";
import * as path from "path";
import * as grpc from "@grpc/grpc-js";
import { IDEConfig, IDEService } from "../ide-service";
import { IDEOption, IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { ExtendedUser } from "@gitpod/ws-manager/lib/constraints";
import {
    FailedInstanceStartReason,
    increaseFailedInstanceStartCounter,
    increaseImageBuildsCompletedTotal,
    increaseImageBuildsStartedTotal,
    increaseSuccessfulInstanceStartCounter,
} from "../prometheus-metrics";
import { ContextParser } from "./context-parser-service";
import { WorkspaceClusterImagebuilderClientProvider } from "./workspace-cluster-imagebuilder-client-provider";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { WorkspaceClasses, WorkspaceClassesConfig } from "./workspace-classes";
import { EntitlementService } from "../billing/entitlement-service";
import { BillingModes } from "../../ee/src/billing/billing-mode";
import { AttributionId } from "@gitpod/gitpod-protocol/lib/attribution";
import { BillingMode } from "@gitpod/gitpod-protocol/lib/billing-mode";
import { LogContext } from "@gitpod/gitpod-protocol/lib/util/logging";

export interface StartWorkspaceOptions {
    rethrow?: boolean;
    forceDefaultImage?: boolean;
    excludeFeatureFlags?: NamedWorkspaceFeatureFlag[];
}

const MAX_INSTANCE_START_RETRIES = 2;
const INSTANCE_START_RETRY_INTERVAL_SECONDS = 2;

// TODO(ak) move to IDE service
export const migrationIDESettings = (user: User) => {
    if (!user?.additionalData?.ideSettings || user.additionalData.ideSettings.settingVersion === "2.0") {
        return;
    }
    const newIDESettings: IDESettings = {
        settingVersion: "2.0",
    };
    const ideSettings = user.additionalData.ideSettings;
    if (ideSettings.useDesktopIde) {
        if (ideSettings.defaultDesktopIde === "code-desktop") {
            newIDESettings.defaultIde = "code-desktop";
        } else if (ideSettings.defaultDesktopIde === "code-desktop-insiders") {
            newIDESettings.defaultIde = "code-desktop";
            newIDESettings.useLatestVersion = true;
        } else {
            newIDESettings.defaultIde = ideSettings.defaultDesktopIde;
            newIDESettings.useLatestVersion = ideSettings.useLatestVersion;
        }
    } else {
        const useLatest = ideSettings.defaultIde === "code-latest";
        newIDESettings.defaultIde = "code";
        newIDESettings.useLatestVersion = useLatest;
    }
    return newIDESettings;
};

// TODO(ak) move to IDE service
export const chooseIDE = (
    ideChoice: string,
    ideOptions: IDEOptions,
    useLatest: boolean,
    hasIdeSettingPerm: boolean,
) => {
    const defaultIDEOption = ideOptions.options[ideOptions.defaultIde];
    const defaultIdeImage = useLatest ? defaultIDEOption.latestImage ?? defaultIDEOption.image : defaultIDEOption.image;
    const data: { desktopIdeImage?: string; desktopIdePluginImage?: string; ideImage: string } = {
        ideImage: defaultIdeImage,
    };
    const chooseOption = ideOptions.options[ideChoice] ?? defaultIDEOption;
    const isDesktopIde = chooseOption.type === "desktop";
    if (isDesktopIde) {
        data.desktopIdeImage = useLatest ? chooseOption?.latestImage ?? chooseOption?.image : chooseOption?.image;
        data.desktopIdePluginImage = useLatest
            ? chooseOption?.pluginLatestImage ?? chooseOption?.pluginImage
            : chooseOption?.pluginImage;
        if (hasIdeSettingPerm) {
            data.desktopIdeImage = data.desktopIdeImage || ideChoice;
        }
    } else {
        data.ideImage = useLatest ? chooseOption?.latestImage ?? chooseOption?.image : chooseOption?.image;
        if (hasIdeSettingPerm) {
            data.ideImage = data.ideImage || ideChoice;
        }
    }
    if (!data.ideImage) {
        data.ideImage = defaultIdeImage;
        // throw new Error("cannot choose correct browser ide");
    }
    return data;
};

export async function getWorkspaceClassForInstance(
    ctx: TraceContext,
    workspace: Workspace,
    previousInstance: WorkspaceInstance | undefined,
    user: User,
    entitlementService: EntitlementService,
    config: WorkspaceClassesConfig,
    workspaceDb: DBWithTracing<WorkspaceDB>,
): Promise<string> {
    const span = TraceContext.startSpan("getWorkspaceClassForInstance", ctx);
    try {
        let workspaceClass = "";
        if (!previousInstance?.workspaceClass) {
            if (workspace.type == "regular") {
                const prebuildClass = await WorkspaceClasses.getFromPrebuild(ctx, workspace, workspaceDb.trace(ctx));
                if (prebuildClass) {
                    const userClass = await WorkspaceClasses.getConfiguredOrUpgradeFromLegacy(
                        user,
                        config,
                        entitlementService,
                    );
                    workspaceClass = WorkspaceClasses.selectClassForRegular(prebuildClass, userClass, config);
                } else if (user.additionalData?.workspaceClasses?.regular) {
                    workspaceClass = user.additionalData?.workspaceClasses?.regular;
                }
            }

            if (workspace.type == "prebuild") {
                if (user.additionalData?.workspaceClasses?.prebuild) {
                    workspaceClass = user.additionalData?.workspaceClasses?.prebuild;
                }
            }

            if (!workspaceClass) {
                workspaceClass = WorkspaceClasses.getDefaultId(config);
                if (await entitlementService.userGetsMoreResources(user)) {
                    workspaceClass = WorkspaceClasses.getMoreResourcesIdOrDefault(config);
                }
            }
        } else {
            workspaceClass = WorkspaceClasses.getPreviousOrDefault(config, previousInstance.workspaceClass);
        }

        return workspaceClass;
    } finally {
        span.finish();
    }
}

class StartInstanceError extends Error {
    constructor(public readonly reason: FailedInstanceStartReason, public readonly cause: Error) {
        super("Starting workspace instance failed: " + cause.message);
    }
}

@injectable()
export class WorkspaceStarter {
    @inject(WorkspaceManagerClientProvider) protected readonly clientProvider: WorkspaceManagerClientProvider;
    @inject(Config) protected readonly config: Config;
    @inject(IDEService) private readonly ideService: IDEService;
    @inject(TracedWorkspaceDB) protected readonly workspaceDb: DBWithTracing<WorkspaceDB>;
    @inject(TracedUserDB) protected readonly userDB: DBWithTracing<UserDB>;
    @inject(TokenProvider) protected readonly tokenProvider: TokenProvider;
    @inject(HostContextProvider) protected readonly hostContextProvider: HostContextProvider;
    @inject(MessageBusIntegration) protected readonly messageBus: MessageBusIntegration;
    @inject(AuthorizationService) protected readonly authService: AuthorizationService;
    @inject(ImageBuilderClientProvider) protected readonly imagebuilderClientProvider: ImageBuilderClientProvider;
    @inject(WorkspaceClusterImagebuilderClientProvider)
    protected readonly wsClusterImageBuilderClientProvider: ImageBuilderClientProvider;
    @inject(ImageSourceProvider) protected readonly imageSourceProvider: ImageSourceProvider;
    @inject(UserService) protected readonly userService: UserService;
    @inject(IAnalyticsWriter) protected readonly analytics: IAnalyticsWriter;
    @inject(OneTimeSecretServer) protected readonly otsServer: OneTimeSecretServer;
    @inject(ProjectDB) protected readonly projectDB: ProjectDB;
    @inject(ContextParser) protected contextParser: ContextParser;
    @inject(BlockedRepositoryDB) protected readonly blockedRepositoryDB: BlockedRepositoryDB;
    @inject(TeamDB) protected readonly teamDB: TeamDB;
    @inject(EntitlementService) protected readonly entitlementService: EntitlementService;
    @inject(BillingModes) protected readonly billingModes: BillingModes;

    public async startWorkspace(
        ctx: TraceContext,
        workspace: Workspace,
        user: User,
        userEnvVars: UserEnvVar[],
        projectEnvVars: ProjectEnvVar[],
        options?: StartWorkspaceOptions,
    ): Promise<StartWorkspaceResult> {
        const span = TraceContext.startSpan("WorkspaceStarter.startWorkspace", ctx);
        span.setTag("workspaceId", workspace.id);

        if (workspace.projectId && workspace.type === "regular") {
            /* tslint:disable-next-line */
            /** no await */ this.projectDB.updateProjectUsage(workspace.projectId, {
                lastWorkspaceStart: new Date().toISOString(),
            });
        }

        options = options || {};
        let instanceId: string | undefined = undefined;
        try {
            await this.checkBlockedRepository(user, workspace.contextURL);

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
                const req = new ResolveBaseImageRequest();
                req.setRef(this.config.workspaceDefaults.workspaceImage);
                const allowAll = new BuildRegistryAuthTotal();
                allowAll.setAllowAll(true);
                const auth = new BuildRegistryAuth();
                auth.setTotal(allowAll);
                req.setAuth(auth);

                const client = await this.getImageBuilderClient(user, workspace, undefined);
                const res = await client.resolveBaseImage({ span }, req);
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

            const ideConfig = await this.ideService.getIDEConfig();

            // create and store instance
            let instance = await this.workspaceDb
                .trace({ span })
                .storeInstance(
                    await this.newInstance(
                        ctx,
                        workspace,
                        lastValidWorkspaceInstance,
                        user,
                        options.excludeFeatureFlags || [],
                        ideConfig,
                    ),
                );
            span.log({ newInstance: instance.id });
            instanceId = instance.id;

            const forceRebuild = !!workspace.context.forceImageBuild;

            let needsImageBuild: boolean;
            try {
                // if we need to build the workspace image we musn't wait for actuallyStartWorkspace to return as that would block the
                // frontend until the image is built.
                const additionalAuth = await this.getAdditionalImageAuth(projectEnvVars);
                needsImageBuild =
                    forceRebuild || (await this.needsImageBuild({ span }, user, workspace, instance, additionalAuth));
                if (needsImageBuild) {
                    instance.status.conditions = {
                        neededImageBuild: true,
                    };
                }
                span.setTag("needsImageBuild", needsImageBuild);
            } catch (err) {
                // if we fail to check if the workspace needs an image build (e.g. becuase the image builder is unavailable),
                // we must properly fail the workspace instance, i.e. set its status to stopped, deal with prebuilds etc.
                //
                // Once we've reached actuallyStartWorkspace that function will take care of failing the instance.
                await this.failInstanceStart({ span }, err, workspace, instance);
                throw err;
            }

            // If the caller requested that errors be rethrown we must await the actual workspace start to be in the exception path.
            // To this end we disable the needsImageBuild behaviour if rethrow is true.
            if (needsImageBuild && !options.rethrow) {
                this.actuallyStartWorkspace(
                    { span },
                    instance,
                    workspace,
                    user,
                    lastValidWorkspaceInstance?.id ?? "",
                    ideConfig,
                    userEnvVars,
                    projectEnvVars,
                    options.rethrow,
                    forceRebuild,
                ).catch((err) => log.error("actuallyStartWorkspace", err));
                return { instanceID: instance.id };
            }

            return await this.actuallyStartWorkspace(
                { span },
                instance,
                workspace,
                user,
                lastValidWorkspaceInstance?.id ?? "",
                ideConfig,
                userEnvVars,
                projectEnvVars,
                options.rethrow,
                forceRebuild,
            );
        } catch (e) {
            this.logAndTraceStartWorkspaceError({ span }, { userId: user.id, instanceId }, e);
            throw e;
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
        ctx.span?.setTag("stopWorkspaceReason", reason);
        log.info({ instanceId }, "Stopping workspace instance", { reason });

        const req = new StopWorkspaceRequest();
        req.setId(instanceId);
        req.setPolicy(policy || StopWorkspacePolicy.NORMALLY);

        const client = await this.clientProvider.get(instanceRegion, this.config.installationShortname);
        await client.stopWorkspace(ctx, req);
    }

    protected async checkBlockedRepository(user: User, contextURL: string) {
        const blockedRepository = await this.blockedRepositoryDB.findBlockedRepositoryByURL(contextURL);
        if (!blockedRepository) return;

        if (blockedRepository.blockUser) {
            try {
                await this.userService.blockUser(user.id, true);
                log.info({ userId: user.id }, "Blocked user.", { contextURL });
            } catch (error) {
                log.error({ userId: user.id }, "Failed to block user.", error, { contextURL });
            }
        }
        throw new Error(`${contextURL} is blocklisted on Gitpod.`);
    }

    // Note: this function does not expect to be awaited for by its caller. This means that it takes care of error handling itself.
    protected async actuallyStartWorkspace(
        ctx: TraceContext,
        instance: WorkspaceInstance,
        workspace: Workspace,
        user: User,
        lastValidWorkspaceInstanceId: string,
        ideConfig: IDEConfig,
        userEnvVars: UserEnvVar[],
        projectEnvVars: ProjectEnvVar[],
        rethrow?: boolean,
        forceRebuild?: boolean,
    ): Promise<StartWorkspaceResult> {
        const span = TraceContext.startSpan("actuallyStartWorkspace", ctx);

        try {
            // build workspace image
            const additionalAuth = await this.getAdditionalImageAuth(projectEnvVars);
            instance = await this.buildWorkspaceImage(
                { span },
                user,
                workspace,
                instance,
                additionalAuth,
                forceRebuild,
                forceRebuild,
            );

            let type: WorkspaceType = WorkspaceType.REGULAR;
            if (workspace.type === "prebuild") {
                type = WorkspaceType.PREBUILD;
            }

            // create spec
            const spec = await this.createSpec(
                { span },
                user,
                workspace,
                instance,
                lastValidWorkspaceInstanceId,
                ideConfig,
                userEnvVars,
                projectEnvVars,
            );

            // create start workspace request
            const metadata = await this.createMetadata(workspace);
            const startRequest = new StartWorkspaceRequest();
            startRequest.setId(instance.id);
            startRequest.setMetadata(metadata);
            startRequest.setType(type);
            startRequest.setSpec(spec);
            startRequest.setServicePrefix(workspace.id);

            // we add additional information to the user to help with cluster selection
            const euser: ExtendedUser = {
                ...user,
            };

            // choose a cluster and start the instance
            let resp: StartWorkspaceResponse.AsObject | undefined = undefined;
            let retries = 0;
            try {
                for (; retries < MAX_INSTANCE_START_RETRIES; retries++) {
                    resp = await this.tryStartOnCluster({ span }, startRequest, euser, workspace, instance);
                    if (resp) {
                        break;
                    }
                    await new Promise((resolve) => setTimeout(resolve, INSTANCE_START_RETRY_INTERVAL_SECONDS * 1000));
                }
            } catch (err) {
                await this.failInstanceStart({ span }, err, workspace, instance);
                throw new StartInstanceError("startOnClusterFailed", err);
            }

            if (!resp) {
                const err = new Error("cannot start a workspace because no workspace clusters are available");
                await this.failInstanceStart({ span }, err, workspace, instance);
                throw new StartInstanceError("clusterSelectionFailed", err);
            }
            increaseSuccessfulInstanceStartCounter(retries);

            span.log({ resp: resp });

            this.analytics.track({
                userId: user.id,
                event: "workspace_started",
                properties: {
                    workspaceId: workspace.id,
                    instanceId: instance.id,
                    projectId: workspace.projectId,
                    contextURL: workspace.contextURL,
                    type: workspace.type,
                    usesPrebuild: spec.getInitializer()?.hasPrebuild(),
                },
            });

            {
                if (type === WorkspaceType.PREBUILD) {
                    // do not await
                    this.notifyOnPrebuildQueued(ctx, workspace.id).catch((err) => {
                        log.error("failed to notify on prebuild queued", err);
                    });
                }
            }

            return { instanceID: instance.id, workspaceURL: resp.url };
        } catch (err) {
            if (rethrow) {
                throw err;
            } else {
                this.logAndTraceStartWorkspaceError({ span }, { userId: user.id, instanceId: instance.id }, err);
            }

            return { instanceID: instance.id };
        } finally {
            span.finish();
        }
    }

    protected logAndTraceStartWorkspaceError(ctx: TraceContext, logCtx: LogContext, err: any) {
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

    protected async createMetadata(workspace: Workspace): Promise<WorkspaceMetadata> {
        let metadata = new WorkspaceMetadata();
        metadata.setOwner(workspace.ownerId);
        metadata.setMetaId(workspace.id);
        if (workspace.projectId) {
            metadata.setProject(workspace.projectId);
            let project = await this.projectDB.findProjectById(workspace.projectId);
            if (project && project.teamId) {
                metadata.setTeam(project.teamId);
            }
        }

        return metadata;
    }

    protected async tryStartOnCluster(
        ctx: TraceContext,
        startRequest: StartWorkspaceRequest,
        euser: ExtendedUser,
        workspace: Workspace,
        instance: WorkspaceInstance,
    ): Promise<StartWorkspaceResponse.AsObject | undefined> {
        let lastInstallation = "";
        const clusters = await this.clientProvider.getStartClusterSets(
            this.config.installationShortname,
            euser,
            workspace,
            instance,
        );
        for await (let cluster of clusters) {
            try {
                // getStartManager will throw an exception if there's no cluster available and hence exit the loop
                const { manager, installation } = cluster;
                lastInstallation = installation;

                instance.status.phase = "pending";
                instance.region = installation;
                await this.workspaceDb.trace(ctx).storeInstance(instance);
                try {
                    await this.messageBus.notifyOnInstanceUpdate(workspace.ownerId, instance);
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
                if ("code" in err && err.code !== grpc.status.OK && lastInstallation !== "") {
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

    protected async getAdditionalImageAuth(projectEnvVars: ProjectEnvVar[]): Promise<Map<string, string>> {
        const res = new Map<string, string>();
        const imageAuth = projectEnvVars.find((e) => e.name === "GITPOD_IMAGE_AUTH");
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

    protected async notifyOnPrebuildQueued(ctx: TraceContext, workspaceId: string) {
        const span = TraceContext.startSpan("notifyOnPrebuildQueued", ctx);
        try {
            const prebuild = await this.workspaceDb.trace({ span }).findPrebuildByWorkspaceID(workspaceId);
            if (prebuild) {
                const info = (await this.workspaceDb.trace({ span }).findPrebuildInfos([prebuild.id]))[0];
                if (info) {
                    await this.messageBus.notifyOnPrebuildUpdate({ info, status: "queued" });
                }
            }
        } catch (e) {
            TraceContext.setError({ span }, e);
            throw e;
        } finally {
            span.finish();
        }
    }

    /**
     * failInstanceStart properly fails a workspace instance if something goes wrong before the instance ever reaches
     * workspace manager. In this case we need to make sure we also fulfil the tasks of the bridge (e.g. for prebulds).
     */
    protected async failInstanceStart(
        ctx: TraceContext,
        err: Error,
        workspace: Workspace,
        instance: WorkspaceInstance,
    ) {
        const span = TraceContext.startSpan("failInstanceStart", ctx);

        try {
            // We may have never actually started the workspace which means that ws-manager-bridge never set a workspace status.
            // We have to set that status ourselves.
            instance.status.phase = "stopped";
            instance.stoppingTime = new Date().toISOString();
            instance.stoppedTime = new Date().toISOString();

            instance.status.conditions.failed = err.toString();
            instance.status.message = `Workspace cannot be started: ${err}`;
            await this.workspaceDb.trace({ span }).storeInstance(instance);
            await this.messageBus.notifyOnInstanceUpdate(workspace.ownerId, instance);

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

    protected async failPrebuildWorkspace(ctx: TraceContext, err: Error, workspace: Workspace) {
        const span = TraceContext.startSpan("failInstanceStart", ctx);
        try {
            if (workspace.type === "prebuild") {
                const prebuild = await this.workspaceDb.trace({ span }).findPrebuildByWorkspaceID(workspace.id);
                if (prebuild && prebuild.state !== "failed") {
                    prebuild.state = "failed";
                    prebuild.error = err.toString();

                    await this.workspaceDb.trace({ span }).storePrebuiltWorkspace(prebuild);
                    await this.messageBus.notifyHeadlessUpdate({ span }, workspace.ownerId, workspace.id, {
                        type: HeadlessWorkspaceEventType.Failed,
                        workspaceID: workspace.id, // required in prebuild-queue-maintainer.ts
                        text: "",
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
    protected async newInstance(
        ctx: TraceContext,
        workspace: Workspace,
        previousInstance: WorkspaceInstance | undefined,
        user: User,
        excludeFeatureFlags: NamedWorkspaceFeatureFlag[],
        ideConfig: IDEConfig,
    ): Promise<WorkspaceInstance> {
        const span = TraceContext.startSpan("newInstance", ctx);
        //#endregion IDE resolution TODO(ak) move to IDE service
        // TODO: Compatible with ide-config not deployed, need revert after ide-config deployed
        delete ideConfig.ideOptions.options["code-latest"];
        delete ideConfig.ideOptions.options["code-desktop-insiders"];

        try {
            const migrated = migrationIDESettings(user);
            if (user.additionalData?.ideSettings && migrated) {
                user.additionalData.ideSettings = migrated;
            }

            const ideChoice = user.additionalData?.ideSettings?.defaultIde;
            const useLatest = !!user.additionalData?.ideSettings?.useLatestVersion;

            // TODO(cw): once we allow changing the IDE in the workspace config (i.e. .gitpod.yml), we must
            //           give that value precedence over the default choice.
            const configuration: WorkspaceInstanceConfiguration = {
                ideImage: ideConfig.ideOptions.options[ideConfig.ideOptions.defaultIde].image,
                supervisorImage: ideConfig.supervisorImage,
                ideConfig: {
                    // We only check user setting because if code(insider) but desktopIde has no latestImage
                    // it still need to notice user that this workspace is using latest IDE
                    useLatest: user.additionalData?.ideSettings?.useLatestVersion,
                },
            };

            if (!!ideChoice) {
                const choose = chooseIDE(
                    ideChoice,
                    ideConfig.ideOptions,
                    useLatest,
                    this.authService.hasPermission(user, "ide-settings"),
                );
                configuration.ideImage = choose.ideImage;
                configuration.desktopIdeImage = choose.desktopIdeImage;
                configuration.desktopIdePluginImage = choose.desktopIdePluginImage;
            }

            const referrerIde = this.resolveReferrerIDE(workspace, user, ideConfig);
            if (referrerIde) {
                configuration.desktopIdeImage = useLatest
                    ? referrerIde.option.latestImage ?? referrerIde.option.image
                    : referrerIde.option.image;
                configuration.desktopIdePluginImage = useLatest
                    ? referrerIde.option.pluginLatestImage ?? referrerIde.option.pluginImage
                    : referrerIde.option.pluginImage;
                if (!user.additionalData?.ideSettings) {
                    // A user does not have IDE settings configured yet configure it with a referrer ide as default.
                    const additionalData = user?.additionalData || {};
                    const settings = additionalData.ideSettings || {};
                    settings.settingVersion = "2.0";
                    settings.defaultIde = referrerIde.id;
                    additionalData.ideSettings = settings;
                    user.additionalData = additionalData;
                    this.userDB
                        .trace(ctx)
                        .updateUserPartial(user)
                        .catch((e) => {
                            log.error({ userId: user.id }, "cannot configure default desktop ide", e);
                        });
                }
            }
            //#endregion

            const billingTier = await this.entitlementService.getBillingTier(user);

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

            await this.tryEnableConnectionLimiting(featureFlags, user, billingTier);
            await this.tryEnablePSI(featureFlags, user, billingTier);

            const usageAttributionId = await this.userService.getWorkspaceUsageAttributionId(user, workspace.projectId);
            const billingMode = await this.billingModes.getBillingMode(usageAttributionId, new Date());

            let workspaceClass = "";
            if (BillingMode.canSetWorkspaceClass(billingMode)) {
                // this is either the first time we start the workspace or the workspace was started
                // before workspace classes and does not have a class yet
                workspaceClass = await getWorkspaceClassForInstance(
                    ctx,
                    workspace,
                    previousInstance,
                    user,
                    this.entitlementService,
                    this.config.workspaceClasses,
                    this.workspaceDb,
                );

                if (featureFlags.includes("persistent_volume_claim")) {
                    if (workspaceClass === "g1-standard" || workspaceClass === "g1-large") {
                        workspaceClass = workspaceClass + "-pvc";
                    }
                }

                featureFlags = featureFlags.concat(["workspace_class_limiting"]);
            } else {
                // todo: remove this once pvc has been rolled out
                const prebuildClass = await WorkspaceClasses.getFromPrebuild(
                    ctx,
                    workspace,
                    this.workspaceDb.trace(ctx),
                );
                if (prebuildClass?.endsWith("-pvc")) {
                    workspaceClass = prebuildClass;
                    // ####
                } else {
                    workspaceClass = "default";
                    if (await this.entitlementService.userGetsMoreResources(user)) {
                        workspaceClass = "gitpodio-internal-xl";
                    }
                }
            }

            if (!!featureFlags) {
                // only set feature flags if there actually are any. Otherwise we waste the
                // few bytes of JSON in the database for no good reason.
                configuration.featureFlags = featureFlags;
            }

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

    private async tryEnableConnectionLimiting(
        featureFlags: NamedWorkspaceFeatureFlag[],
        user: User,
        billingTier: BillingTier,
    ) {
        const wsConnectionLimitingEnabled = await getExperimentsClientForBackend().getValueAsync(
            "workspace_connection_limiting",
            false,
            {
                user,
                billingTier,
            },
        );

        if (wsConnectionLimitingEnabled) {
            const shouldLimitNetworkConnections = await this.entitlementService.limitNetworkConnections(
                user,
                new Date(),
            );
            if (shouldLimitNetworkConnections) {
                featureFlags.push("workspace_connection_limiting");
            }
        }
    }

    private async tryEnablePSI(featureFlags: NamedWorkspaceFeatureFlag[], user: User, billingTier: BillingTier) {
        const psiEnabled = await getExperimentsClientForBackend().getValueAsync("pressure_stall_info", false, {
            user,
            billingTier,
        });

        if (psiEnabled && billingTier === "paid") {
            featureFlags.push("workspace_psi");
        }
    }

    // TODO(ak) move to IDE service
    protected resolveReferrerIDE(
        workspace: Workspace,
        user: User,
        ideConfig: IDEConfig,
    ): { id: string; option: IDEOption } | undefined {
        if (!WithReferrerContext.is(workspace.context)) {
            return undefined;
        }
        const referrer = ideConfig.ideOptions.clients?.[workspace.context.referrer];
        if (!referrer) {
            return undefined;
        }

        const providedIde = workspace.context.referrerIde;
        const providedOption = providedIde && ideConfig.ideOptions.options[providedIde];
        if (providedOption && referrer.desktopIDEs?.some((ide) => ide === providedIde)) {
            return { id: providedIde, option: providedOption };
        }

        const defaultDesktopIde = user.additionalData?.ideSettings?.defaultDesktopIde;
        const userOption = defaultDesktopIde && ideConfig.ideOptions.options[defaultDesktopIde];
        if (userOption && referrer.desktopIDEs?.some((ide) => ide === defaultDesktopIde)) {
            return { id: defaultDesktopIde, option: userOption };
        }

        const defaultIde = referrer.defaultDesktopIDE;
        const defaultOption = defaultIde && ideConfig.ideOptions.options[defaultIde];
        if (defaultOption) {
            return { id: defaultIde, option: defaultOption };
        }

        return undefined;
    }

    protected async prepareBuildRequest(
        ctx: TraceContext,
        workspace: Workspace,
        imgsrc: WorkspaceImageSource,
        user: User,
        additionalAuth: Map<string, string>,
        ignoreBaseImageresolvedAndRebuildBase: boolean = false,
    ): Promise<{ src: BuildSource; auth: BuildRegistryAuth; disposable?: Disposable }> {
        const span = TraceContext.startSpan("prepareBuildRequest", ctx);

        try {
            // if our workspace ever had its base image built, we do not want to build it again. In this case we use a build source reference
            // and dismiss the original image source.
            if (workspace.baseImageNameResolved && !ignoreBaseImageresolvedAndRebuildBase) {
                span.setTag("hasBaseImageNameResolved", true);
                span.log({ baseImageNameResolved: workspace.baseImageNameResolved });

                const ref = new BuildSourceReference();
                ref.setRef(workspace.baseImageNameResolved);

                const src = new BuildSource();
                src.setRef(ref);

                // It doesn't matter what registries the user has access to at this point.
                // All they need access to is the base image repository, as we're building the Gitpod layer only.
                const nauth = new BuildRegistryAuthSelective();
                nauth.setAllowBaserep(true);
                // The base image is not neccesarily stored on the Gitpod registry, but might also come
                // from a private whitelisted registry also. Hence allowBaserep is not enough, and we also
                // need to explicitly allow all whitelisted registry when resolving the base image.
                nauth.setAnyOfList(this.config.defaultBaseImageRegistryWhitelist);
                const auth = new BuildRegistryAuth();
                auth.setSelective(nauth);

                return { src, auth };
            }

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
                        "",
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

    protected async needsImageBuild(
        ctx: TraceContext,
        user: User,
        workspace: Workspace,
        instance: WorkspaceInstance,
        additionalAuth: Map<string, string>,
    ): Promise<boolean> {
        const span = TraceContext.startSpan("needsImageBuild", ctx);
        try {
            const client = await this.getImageBuilderClient(user, workspace, instance);
            const { src, auth, disposable } = await this.prepareBuildRequest(
                { span },
                workspace,
                workspace.imageSource!,
                user,
                additionalAuth,
            );

            const req = new ResolveWorkspaceImageRequest();
            req.setSource(src);
            req.setAuth(auth);
            const result = await client.resolveWorkspaceImage({ span }, req);

            if (!!disposable) {
                disposable.dispose();
            }

            return result.getStatus() != BuildStatus.DONE_SUCCESS;
        } catch (err) {
            TraceContext.setError({ span }, err);
            throw err;
        } finally {
            span.finish();
        }
    }

    protected async buildWorkspaceImage(
        ctx: TraceContext,
        user: User,
        workspace: Workspace,
        instance: WorkspaceInstance,
        additionalAuth: Map<string, string>,
        ignoreBaseImageresolvedAndRebuildBase: boolean = false,
        forceRebuild: boolean = false,
    ): Promise<WorkspaceInstance> {
        const span = TraceContext.startSpan("buildWorkspaceImage", ctx);

        try {
            // Start build...
            const client = await this.getImageBuilderClient(user, workspace, instance);
            const { src, auth, disposable } = await this.prepareBuildRequest(
                { span },
                workspace,
                workspace.imageSource!,
                user,
                additionalAuth,
                ignoreBaseImageresolvedAndRebuildBase || forceRebuild,
            );

            const req = new BuildRequest();
            req.setSource(src);
            req.setAuth(auth);
            req.setForceRebuild(forceRebuild);
            req.setTriggeredBy(user.id);

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
            await this.messageBus.notifyOnInstanceUpdate(workspace.ownerId, instance);

            let buildResult: BuildResponse;
            try {
                // ...and wait for the build to finish
                buildResult = await result.buildPromise;
                if (buildResult.getStatus() == BuildStatus.DONE_FAILURE) {
                    // Register a failed image build only if the image actually needed to be built; ie the build was not a no-op.
                    if (result.actuallyNeedsBuild) {
                        increaseImageBuildsCompletedTotal("failed");
                    }
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
                    return this.buildWorkspaceImage(ctx, user, workspace, instance, additionalAuth, true, forceRebuild);
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
            const now = new Date().toISOString();
            instance = await this.workspaceDb.trace({ span }).updateInstancePartial(instance.id, {
                status: { ...instance.status, phase: "stopped", conditions: { failed: message }, message },
                stoppedTime: now,
                stoppingTime: now,
            });

            // Mark the PrebuildWorkspace as failed
            await this.failPrebuildWorkspace({ span }, err, workspace);

            // Push updated workspace instance over messagebus
            await this.messageBus.notifyOnInstanceUpdate(workspace.ownerId, instance);

            TraceContext.setError({ span }, err);
            const looksLikeUserError = (msg: string): boolean => {
                return msg.startsWith("build failed:") || msg.includes("headless task failed:");
            };
            if (looksLikeUserError(message)) {
                log.info(
                    { instanceId: instance.id, userId: user.id, workspaceId: workspace.id },
                    `workspace image build failed: ${message}`,
                    { looksLikeUserError: true },
                );
            } else {
                log.error(
                    { instanceId: instance.id, userId: user.id, workspaceId: workspace.id },
                    `workspace image build failed: ${message}`,
                );
                err = new StartInstanceError("imageBuildFailed", err);
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

    protected async createSpec(
        traceCtx: TraceContext,
        user: User,
        workspace: Workspace,
        instance: WorkspaceInstance,
        lastValidWorkspaceInstanceId: string,
        ideConfig: IDEConfig,
        userEnvVars: UserEnvVarValue[],
        projectEnvVars: ProjectEnvVar[],
    ): Promise<StartWorkspaceSpec> {
        const context = workspace.context;

        let allEnvVars: EnvVarWithValue[] = [];
        if (userEnvVars.length > 0) {
            if (CommitContext.is(context)) {
                // this is a commit context, thus we can filter the env vars
                allEnvVars = allEnvVars.concat(
                    UserEnvVar.filter(userEnvVars, context.repository.owner, context.repository.name),
                );
            } else {
                allEnvVars = allEnvVars.concat(userEnvVars);
            }
        }
        if (projectEnvVars.length > 0) {
            // Instead of using an access guard for Project environment variables, we let Project owners decide whether
            // a variable should be:
            //   - exposed in all workspaces (even for non-Project members when the repository is public), or
            //   - censored from all workspaces (even for Project members)
            let availablePrjEnvVars = projectEnvVars;
            if (workspace.type !== "prebuild") {
                availablePrjEnvVars = projectEnvVars.filter((variable) => !variable.censored);
            }
            const withValues = await this.projectDB.getProjectEnvironmentVariableValues(availablePrjEnvVars);
            allEnvVars = allEnvVars.concat(withValues);
        }
        if (WithEnvvarsContext.is(context)) {
            allEnvVars = allEnvVars.concat(context.envvars);
        }

        const envvars: EnvironmentVariable[] = [];

        // TODO(cw): for the time being we're still pushing the env vars as we did before.
        //           Once everything is running with the latest supervisor, we can stop doing that.
        allEnvVars.forEach((e) => {
            const ev = new EnvironmentVariable();
            ev.setName(e.name);
            ev.setValue(e.value);
            envvars.push(ev);
        });

        const ideAlias = user.additionalData?.ideSettings?.defaultIde;
        if (ideAlias && ideConfig.ideOptions.options[ideAlias]) {
            const ideAliasEnv = new EnvironmentVariable();
            ideAliasEnv.setName("GITPOD_IDE_ALIAS");
            ideAliasEnv.setValue(ideAlias);
            envvars.push(ideAliasEnv);
        }

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
        const tasks = this.ideService.resolveGitpodTasks(workspace);
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
            const dbToken: GitpodToken & { user: DBUser } = {
                tokenHash,
                name: `${instance.id}-default`,
                type: GitpodTokenType.MACHINE_AUTH_TOKEN,
                user: user as DBUser,
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

        let volumeSnapshotId = "";
        // always pick lastValidWorkspaceInstanceId if it is valid, otherwise workspace will be restored from prebuild
        // even if there was workspace backup available
        if (lastValidWorkspaceInstanceId != "") {
            volumeSnapshotId = lastValidWorkspaceInstanceId;
        } else if (
            (SnapshotContext.is(workspace.context) || WithPrebuild.is(workspace.context)) &&
            !!workspace.context.snapshotBucketId
        ) {
            volumeSnapshotId = workspace.context.snapshotBucketId;
        }

        let volumeSnapshotInfo = new VolumeSnapshotInfo();
        const volumeSnapshots =
            volumeSnapshotId != ""
                ? await this.workspaceDb.trace(traceCtx).findVolumeSnapshotById(volumeSnapshotId)
                : undefined;
        if (volumeSnapshots !== undefined) {
            log.info("starting workspace with volume snapshot info", {
                lastInstanceId: lastValidWorkspaceInstanceId,
                volSnapshotId: volumeSnapshotId,
                snapshotId: volumeSnapshots.id,
                volumeHandle: volumeSnapshots.volumeHandle,
                workspaceId: workspace.id,
            });
            volumeSnapshotInfo.setVolumeSnapshotName(volumeSnapshots.id);
            volumeSnapshotInfo.setVolumeSnapshotHandle(volumeSnapshots.volumeHandle);
        }

        const initializerPromise = this.createInitializer(
            traceCtx,
            workspace,
            workspace.context,
            user,
            lastValidWorkspaceInstanceId,
            volumeSnapshots !== undefined,
        );
        const userTimeoutPromise = this.entitlementService.getDefaultWorkspaceTimeout(user, new Date());

        let featureFlags = instance.configuration!.featureFlags || [];
        if (volumeSnapshots !== undefined) {
            featureFlags = featureFlags.concat(["persistent_volume_claim"]);
        }

        let ideImage: string;
        if (!!instance.configuration?.ideImage) {
            ideImage = instance.configuration?.ideImage;
        } else {
            ideImage = ideConfig.ideOptions.options[ideConfig.ideOptions.defaultIde].image;
        }

        const spec = new StartWorkspaceSpec();
        await createGitpodTokenPromise;
        spec.setEnvvarsList(envvars);
        spec.setGit(this.createGitSpec(workspace, user));
        spec.setPortsList(ports);
        spec.setInitializer((await initializerPromise).initializer);
        const startWorkspaceSpecIDEImage = new IDEImage();
        startWorkspaceSpecIDEImage.setWebRef(ideImage);
        startWorkspaceSpecIDEImage.setDesktopRef(instance.configuration?.desktopIdeImage || "");
        startWorkspaceSpecIDEImage.setDesktopPluginRef(instance.configuration?.desktopIdePluginImage || "");
        startWorkspaceSpecIDEImage.setSupervisorRef(instance.configuration?.supervisorImage || "");
        spec.setIdeImage(startWorkspaceSpecIDEImage);
        spec.setDeprecatedIdeImage(ideImage);
        spec.setWorkspaceImage(instance.workspaceImage);
        spec.setWorkspaceLocation(workspace.config.workspaceLocation || checkoutLocation);
        spec.setFeatureFlagsList(this.toWorkspaceFeatureFlags(featureFlags));
        spec.setClass(instance.workspaceClass!);

        if (workspace.type === "regular") {
            spec.setTimeout(this.userService.workspaceTimeoutToDuration(await userTimeoutPromise));
        }
        spec.setAdmission(admissionLevel);
        spec.setVolumeSnapshot(volumeSnapshotInfo);
        const sshKeys = await this.userDB.trace(traceCtx).getSSHPublicKeys(user.id);
        spec.setSshPublicKeysList(sshKeys.map((e) => e.key));
        return spec;
    }

    protected createDefaultGitpodAPITokenScopes(workspace: Workspace, instance: WorkspaceInstance): string[] {
        const scopes = [
            "function:getWorkspace",
            "function:getLoggedInUser",
            "function:getPortAuthenticationToken",
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
            "function:getContentBlobUploadUrl",
            "function:getContentBlobDownloadUrl",
            "function:accessCodeSyncStorage",
            "function:guessGitTokenScopes",
            "function:getEnvVars",
            "function:setEnvVar",
            "function:deleteEnvVar",
            "function:hasSSHPublicKey",
            "function:getSSHPublicKeys",
            "function:addSSHPublicKey",
            "function:deleteSSHPublicKey",
            "function:getTeams",
            "function:trackEvent",
            "function:getSupportedWorkspaceClasses",

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

    protected createGitSpec(workspace: Workspace, user: User): GitSpec {
        const context = workspace.context;
        if (!CommitContext.is(context)) {
            // this is not a commit context, thus we cannot produce a sensible GitSpec
            return new GitSpec();
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

        const gitSpec = new GitSpec();
        gitSpec.setUsername(user.fullName || identity.authName);
        gitSpec.setEmail(identity.primaryEmail!);
        return gitSpec;
    }

    protected async createInitializer(
        traceCtx: TraceContext,
        workspace: Workspace,
        context: WorkspaceContext,
        user: User,
        lastValidWorkspaceInstanceId: string,
        hasVolumeSnapshot: boolean,
    ): Promise<{ initializer: WorkspaceInitializer; disposable: Disposable }> {
        let result = new WorkspaceInitializer();
        const disp = new DisposableCollection();

        if (lastValidWorkspaceInstanceId != "") {
            const backup = new FromBackupInitializer();
            if (CommitContext.is(context)) {
                backup.setCheckoutLocation(context.checkoutLocation || "");
            }
            backup.setFromVolumeSnapshot(hasVolumeSnapshot);
            result.setBackup(backup);
        } else if (SnapshotContext.is(context)) {
            const snapshot = new SnapshotInitializer();
            snapshot.setSnapshot(context.snapshotBucketId);
            snapshot.setFromVolumeSnapshot(hasVolumeSnapshot);
            result.setSnapshot(snapshot);
        } else if (WithPrebuild.is(context)) {
            if (!CommitContext.is(context)) {
                throw new Error("context is not a commit context");
            }

            const snapshot = new SnapshotInitializer();
            snapshot.setSnapshot(context.snapshotBucketId);
            snapshot.setFromVolumeSnapshot(hasVolumeSnapshot);
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
            throw new Error("cannot create initializer for unkown context type");
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
                    finfo.setUrl(url.token);
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

    protected async createCommitInitializer(
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

    protected async createGitInitializer(
        traceCtx: TraceContext,
        workspace: Workspace,
        context: GitCheckoutInfo,
        user: User,
    ): Promise<{ initializer: GitInitializer }> {
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

        var cloneTarget: string | undefined;
        var targetMode: CloneTargetMode;
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

        const gitToken = await this.tokenProvider.getTokenForHost(user, host);
        const username = gitToken.username || "oauth2";

        const gitConfig = new GitConfig();
        gitConfig.setAuthentication(GitAuthMethod.BASIC_AUTH);
        gitConfig.setAuthUser(username);
        gitConfig.setAuthPassword(gitToken.value);

        if (this.config.insecureNoDomain) {
            const token = await this.tokenProvider.getTokenForHost(user, host);
            gitConfig.setAuthentication(GitAuthMethod.BASIC_AUTH);
            gitConfig.setAuthUser(token.username || "oauth2");
            gitConfig.setAuthPassword(token.value);
        }

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

    protected toWorkspaceFeatureFlags(featureFlags: NamedWorkspaceFeatureFlag[]): WorkspaceFeatureFlag[] {
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
     * This method is temporary until we moved image-builder into workspace clusters
     * @param user
     * @param workspace
     * @param instance
     * @returns
     */
    protected async getImageBuilderClient(user: User, workspace: Workspace, instance?: WorkspaceInstance) {
        const isMovedImageBuilder = await getExperimentsClientForBackend().getValueAsync("movedImageBuilder", false, {
            user,
            projectId: workspace.projectId,
        });

        log.info(
            { userId: user.id, workspaceId: workspace.id, instanceId: instance?.id },
            "image-builder in workspace cluster?",
            {
                userId: user.id,
                projectId: workspace.projectId,
                isMovedImageBuilder,
            },
        );
        if (isMovedImageBuilder) {
            return this.wsClusterImageBuilderClientProvider.getClient(
                this.config.installationShortname,
                user,
                workspace,
                instance,
            );
        } else {
            return this.imagebuilderClientProvider.getClient(
                this.config.installationShortname,
                user,
                workspace,
                instance,
            );
        }
    }
}
