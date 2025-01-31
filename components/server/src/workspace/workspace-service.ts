/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import * as grpc from "@grpc/grpc-js";
import { ProjectDB, RedisPublisher, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import {
    CommitContext,
    GetWorkspaceTimeoutResult,
    GitpodServer,
    HeadlessLogUrls,
    PortProtocol,
    PortVisibility,
    Project,
    SetWorkspaceTimeoutResult,
    Snapshot,
    StartWorkspaceResult,
    User,
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
    WithPrebuild,
    Workspace,
    WorkspaceContext,
    WorkspaceInfo,
    WorkspaceInstance,
    WorkspaceInstancePort,
    WorkspaceInstanceRepoStatus,
    WorkspaceSession,
    WorkspaceSoftDeletion,
    WorkspaceTimeoutDuration,
} from "@gitpod/gitpod-protocol";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { generateAsyncGenerator } from "@gitpod/gitpod-protocol/lib/generate-async-generator";
import { Authorizer } from "../authorization/authorizer";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { WorkspaceFactory } from "./workspace-factory";
import {
    DescribeWorkspaceRequest,
    StopWorkspacePolicy,
    PortVisibility as ProtoPortVisibility,
    PortProtocol as ProtoPortProtocol,
    PortSpec,
    ControlPortRequest,
    SetTimeoutRequest,
    MarkActiveRequest,
    AdmissionLevel,
    ControlAdmissionRequest,
    TakeSnapshotRequest,
} from "@gitpod/ws-manager/lib";
import {
    WorkspaceStarter,
    StartWorkspaceOptions as StarterStartWorkspaceOptions,
    isClusterMaintenanceError,
    getWorkspaceClassForInstance,
} from "./workspace-starter";
import { LogContext, log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { EntitlementService, MayStartWorkspaceResult } from "../billing/entitlement-service";
import * as crypto from "crypto";
import { WorkspaceRegion, isWorkspaceRegion } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { RegionService } from "./region-service";
import { LazyPrebuildManager, ProjectsService } from "../projects/projects-service";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import { SupportedWorkspaceClass } from "@gitpod/gitpod-protocol/lib/workspace-class";
import { Config } from "../config";
import { goDurationToHumanReadable } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { HeadlessLogEndpoint, HeadlessLogService } from "./headless-log-service";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { OrganizationService } from "../orgs/organization-service";
import { isGrpcError } from "@gitpod/gitpod-protocol/lib/util/grpc";
import { RedisSubscriber } from "../messaging/redis-subscriber";
import { SnapshotService } from "./snapshot-service";
import { InstallationService } from "../auth/installation-service";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { WatchWorkspaceStatusResponse } from "@gitpod/public-api/lib/gitpod/v1/workspace_pb";
import { ContextParser } from "./context-parser-service";
import { scrubber, TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";

export const GIT_STATUS_LENGTH_CAP_BYTES = 4096;

export interface StartWorkspaceOptions extends StarterStartWorkspaceOptions {
    /**
     * This field is used to guess the workspace location using the RegionService
     */
    clientRegionCode?: string;
}

export type CensorFunc = (instance: WorkspaceInstance) => WorkspaceInstance;

@injectable()
export class WorkspaceService {
    constructor(
        @inject(Config) private readonly config: Config,
        @inject(WorkspaceFactory) private readonly factory: WorkspaceFactory,
        @inject(WorkspaceStarter) private readonly workspaceStarter: WorkspaceStarter,
        @inject(WorkspaceManagerClientProvider) private readonly clientProvider: WorkspaceManagerClientProvider,
        @inject(WorkspaceDB) private readonly db: WorkspaceDB,
        @inject(EntitlementService) private readonly entitlementService: EntitlementService,
        @inject(ProjectsService) private readonly projectsService: ProjectsService,
        @inject(OrganizationService) private readonly orgService: OrganizationService,
        @inject(SnapshotService) private readonly snapshotService: SnapshotService,
        @inject(InstallationService) private readonly installationService: InstallationService,
        @inject(RedisPublisher) private readonly publisher: RedisPublisher,
        @inject(HeadlessLogService) private readonly headlessLogService: HeadlessLogService,
        @inject(Authorizer) private readonly auth: Authorizer,
        @inject(ContextParser) private readonly contextParser: ContextParser,
        @inject(LazyPrebuildManager) private readonly prebuildManager: LazyPrebuildManager,
        @inject(ProjectDB) private readonly projectDB: ProjectDB,

        @inject(RedisSubscriber) private readonly subscriber: RedisSubscriber,
        @inject(PublicAPIConverter) private readonly apiConverter: PublicAPIConverter,
    ) {}

    /**
     * workspaceClassChecking checks if user can create workspace with specified class
     */
    private async workspaceClassChecking(
        ctx: TraceContext,
        userId: string,
        organizationId: string,
        previousInstance: Pick<WorkspaceInstance, "workspaceClass"> | undefined,
        project: Project | undefined,
        workspaceClassOverride: string | undefined,
    ) {
        const workspaceClass = await getWorkspaceClassForInstance(
            ctx,
            { type: "regular" },
            previousInstance,
            project,
            workspaceClassOverride,
            this.config.workspaceClasses,
        );
        const settings = await this.orgService.getSettings(userId, organizationId);
        const allAllowedClsInInstallation = await this.installationService.getInstallationWorkspaceClasses(userId);
        const checkHasOtherOptions = (allowedCls: string[]) =>
            allowedCls.filter((e) => allAllowedClsInInstallation.findIndex((cls) => cls.id === e) !== -1).length > 0;
        if (settings.allowedWorkspaceClasses && settings.allowedWorkspaceClasses.length > 0) {
            if (!settings.allowedWorkspaceClasses.includes(workspaceClass)) {
                const hasOtherOptions = checkHasOtherOptions(settings.allowedWorkspaceClasses);
                if (!hasOtherOptions) {
                    throw new ApplicationError(
                        ErrorCodes.PRECONDITION_FAILED,
                        "No allowed workspace classes available. Please contact an admin to update organization settings.",
                    );
                }
                throw new ApplicationError(
                    ErrorCodes.PRECONDITION_FAILED,
                    "Selected workspace class is not allowed in current organization.",
                );
            }
        }
        if (project?.settings?.restrictedWorkspaceClasses && project.settings.restrictedWorkspaceClasses.length > 0) {
            if (project.settings.restrictedWorkspaceClasses.includes(workspaceClass)) {
                throw new ApplicationError(
                    ErrorCodes.PRECONDITION_FAILED,
                    "Selected workspace class is restricted in current repository.",
                );
            }
        }
    }

    async createWorkspace(
        ctx: TraceContext,
        user: User,
        organizationId: string,
        project: Project | undefined,
        context: WorkspaceContext,
        normalizedContextURL: string,
        workspaceClass: string | undefined,
    ): Promise<Workspace> {
        await this.mayStartWorkspace(ctx, user, organizationId, this.db.findRegularRunningInstances(user.id));

        await this.auth.checkPermissionOnOrganization(user.id, "create_workspace", organizationId);

        await this.workspaceClassChecking(ctx, user.id, organizationId, undefined, project, workspaceClass);

        // We don't want to be doing this in a transaction, because it calls out to external systems.
        // TODO(gpl) Would be great to separate workspace creation from external calls
        const workspace = await this.factory.createForContext(
            ctx,
            user,
            organizationId,
            project,
            context,
            normalizedContextURL,
        );
        log.info({ userId: user.id, workspaceId: workspace.id }, "workspace created", {
            type: workspace.type,
            ownerId: workspace.ownerId,
            organizationId: workspace.organizationId,
            projectId: project?.id,
            projectName: scrubValue(project?.name),
            contextURL: workspace.contextURL,
            context: new TrustedValue<Partial<CommitContext & WithPrebuild>>({
                normalizedContextURL: scrubValue(context.normalizedContextURL),
                repository: CommitContext.is(context)
                    ? {
                          cloneUrl: scrubber.scrubValue(context.repository.cloneUrl),
                          host: scrubber.scrubValue(context.repository.host),
                          owner: scrubber.scrubValue(context.repository.owner),
                          name: scrubber.scrubValue(context.repository.name),
                          private: context.repository.private,
                          defaultBranch: scrubValue(context.repository.defaultBranch),
                      }
                    : undefined,
                ref: scrubValue(context.ref),
                refType: CommitContext.is(context) ? context.refType : undefined,
                revision: CommitContext.is(context) ? scrubValue(context.revision) : undefined,
                wasPrebuilt: WithPrebuild.is(context) ? context.wasPrebuilt : undefined,
                forceCreateNewWorkspace: context.forceCreateNewWorkspace,
                forceImageBuild: context.forceImageBuild,
                snapshotBucketId: WithPrebuild.is(context) ? scrubber.scrubValue(context.snapshotBucketId) : undefined,
            }),
        });

        // Instead, we fall back to removing access in case something goes wrong.
        try {
            await this.auth.addWorkspaceToOrg(organizationId, user.id, workspace.id, !!workspace.shareable);
        } catch (err) {
            await this.hardDeleteWorkspace(user.id, workspace.id).catch((err) =>
                log.error("failed to hard-delete workspace", err),
            );
            throw err;
        }
        this.asyncUpdateDeletionEligibilityTime(user.id, workspace.id, true);
        this.asyncUpdateDeletionEligibilityTimeForUsedPrebuild(user.id, workspace);
        if (project && workspace.type === "regular") {
            this.asyncHandleUpdatePrebuildTriggerStrategy({ ctx, project, workspace, user });
            this.asyncStartPrebuild({ ctx, project, workspace, user });
        }
        return workspace;
    }

    async getWorkspace(userId: string, workspaceId: string): Promise<WorkspaceInfo> {
        const workspace = await this.doGetWorkspace(userId, workspaceId);
        const latestInstance = await this.db.findCurrentInstance(workspaceId);

        return {
            workspace,
            latestInstance,
        };
    }

    async getWorkspaces(userId: string, options: GitpodServer.GetWorkspacesOptions): Promise<WorkspaceInfo[]> {
        const res = await this.db.find({
            limit: 20,
            ...options,
            userId, // gpl: We probably want to removed this limitation in the future, but keeping the old behavior for now due to focus on FGA
            includeHeadless: false,
        });

        const filtered = (
            await Promise.all(
                res.map(async (info) =>
                    (await this.auth.hasPermissionOnWorkspace(userId, "access", info.workspace.id)) ? info : undefined,
                ),
            )
        ).filter((info) => !!info) as WorkspaceInfo[];
        return filtered;
    }

    async listWorkspaceSessions(
        userId: string,
        organizationId: string,
        from: Date,
        to: Date,
        limit: number,
        offset: number,
    ): Promise<WorkspaceSession[]> {
        await this.auth.checkPermissionOnOrganization(userId, "read_sessions", organizationId);

        // check from is before to
        if (from >= to) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "from must be before to");
        }
        // check limit is positive
        if (limit < 0) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "limit must be positive");
        }
        if (limit > 1000) {
            log.info("listWorkspaceSessions limit was set too high. Using 1000 instead", { limit, organizationId });
        }

        return this.db.findSessionsInPeriod(organizationId, from, to, Math.min(limit, 1000), offset);
    }

    /**
     * @param opts.skipPermissionCheck and do permission check outside
     */
    async getCurrentInstance(
        userId: string,
        workspaceId: string,
        opts?: { skipPermissionCheck?: boolean },
    ): Promise<WorkspaceInstance> {
        if (!opts?.skipPermissionCheck) {
            await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);
        }
        const result = await this.db.findCurrentInstance(workspaceId);
        if (!result) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "No workspace instance found.", { workspaceId });
        }
        return result;
    }

    // Internal method for allowing for additional DBs to be passed in
    private async doGetWorkspace(userId: string, workspaceId: string, db: WorkspaceDB = this.db): Promise<Workspace> {
        const workspace = await db.findById(workspaceId);

        if (workspace?.type === "prebuild" && workspace.projectId) {
            await this.auth.checkPermissionOnProject(userId, "read_prebuild", workspace.projectId);
        } else {
            await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);
        }

        // TODO(gpl) We might want to add || !!workspace.softDeleted here in the future, but we were unsure how that would affect existing clients
        // In order to reduce risk, we leave it for a future changeset.
        if (!workspace || workspace.deleted) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Workspace not found.");
        }
        return workspace;
    }

    async getOwnerToken(userId: string, workspaceId: string): Promise<string> {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);

        // Check: is deleted?
        await this.getWorkspace(userId, workspaceId);

        const latestInstance = await this.db.findCurrentInstance(workspaceId);
        const ownerToken = latestInstance?.status.ownerToken;
        if (!ownerToken) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "owner token not found");
        }
        return ownerToken;
    }

    async getIDECredentials(userId: string, workspaceId: string): Promise<string> {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);

        const ws = await this.doGetWorkspace(userId, workspaceId);
        if (ws.config.ideCredentials) {
            return ws.config.ideCredentials;
        }

        return this.db.transaction(async (db) => {
            const ws = await this.doGetWorkspace(userId, workspaceId, db);
            if (ws.config.ideCredentials) {
                return ws.config.ideCredentials;
            }
            ws.config.ideCredentials = crypto.randomBytes(32).toString("base64");
            await db.store(ws);
            return ws.config.ideCredentials;
        });
    }

    // stopWorkspace and related methods below
    async stopWorkspace(
        userId: string,
        workspaceId: string,
        reason: string,
        policy?: StopWorkspacePolicy,
        options: { skipPermissionCheck?: boolean } = {},
    ): Promise<void> {
        if (!options.skipPermissionCheck) {
            await this.auth.checkPermissionOnWorkspace(userId, "stop", workspaceId);
        }

        const workspace = await this.doGetWorkspace(userId, workspaceId);
        const instance = await this.db.findRunningInstance(workspace.id);
        if (!instance) {
            // there's no instance running - we're done
            return;
        }
        await this.workspaceStarter.stopWorkspaceInstance({}, instance.id, instance.region, reason, policy);
        this.asyncUpdateDeletionEligibilityTime(userId, workspaceId, true);
    }

    public async stopRunningWorkspacesForUser(
        ctx: TraceContext,
        userId: string,
        targetUserId: string,
        reason: string,
        policy?: StopWorkspacePolicy,
    ): Promise<Workspace[]> {
        const infos = await this.db.findRunningInstancesWithWorkspaces(undefined, targetUserId);
        await Promise.all(
            infos.map(async (info) => {
                await this.auth.checkPermissionOnWorkspace(userId, "stop", info.workspace.id);
                await this.workspaceStarter.stopWorkspaceInstance(
                    ctx,
                    info.latestInstance.id,
                    info.latestInstance.region,
                    reason,
                    policy,
                );
                this.asyncUpdateDeletionEligibilityTime(userId, info.workspace.id, false);
            }),
        );
        return infos.map((instance) => instance.workspace);
    }

    private asyncUpdateDeletionEligibilityTimeForUsedPrebuild(userId: string, workspace: Workspace): void {
        (async () => {
            if (WithPrebuild.is(workspace.context) && workspace.context.prebuildWorkspaceId) {
                // mark the prebuild active
                const prebuiltWorkspace = await this.db.findPrebuiltWorkspaceById(
                    workspace.context.prebuildWorkspaceId,
                );
                if (prebuiltWorkspace?.buildWorkspaceId) {
                    await this.updateDeletionEligibilityTime(userId, prebuiltWorkspace?.buildWorkspaceId, true);
                }
            }
        })().catch((err) =>
            log.error(
                { userId, workspaceId: workspace.id },
                "Failed to update deletion eligibility time for prebuild",
                err,
            ),
        );
    }

    private asyncStartPrebuild({
        ctx,
        project,
        workspace,
        user,
    }: {
        ctx: TraceContext;
        project: Project;
        workspace: Workspace;
        user: User;
    }): void {
        (async () => {
            const logCtx = { userId: user.id, workspaceId: workspace.id };
            const prebuildManager = this.prebuildManager();

            const context = (await this.contextParser.handle(ctx, user, workspace.contextURL)) as CommitContext;
            const config = await prebuildManager.fetchConfig(ctx, user, context, project?.teamId);
            const prebuildPrecondition = prebuildManager.checkPrebuildPrecondition({
                config,
                project,
                context,
            });
            if (!prebuildPrecondition.shouldRun) {
                log.info(logCtx, "Workspace create event: No prebuild.", { config, context });
                return;
            }

            const res = await prebuildManager.startPrebuild(ctx, {
                user,
                project,
                forcePrebuild: false,
                context,
                trigger: "lastWorkspaceStart",
                assumeProjectActive: true,
            });
            log.info(logCtx, "starting prebuild after workspace creation", {
                projectId: project.id,
                projectName: scrubValue(project.name),
                result: new TrustedValue({
                    prebuildId: new TrustedValue(res.prebuildId),
                    wsid: scrubValue(res.wsid),
                    done: res.done,
                }),
            });
        })().catch((err) =>
            log.error(
                { userId: user.id, workspaceId: workspace.id },
                "Failed to start prebuild after workspace creation",
                err,
            ),
        );
    }

    private asyncHandleUpdatePrebuildTriggerStrategy({
        ctx,
        project,
        workspace,
        user,
    }: {
        ctx: TraceContext;
        project: Project;
        workspace: Workspace;
        user: User;
    }): void {
        if (project.settings?.prebuilds?.triggerStrategy === "activity-based") {
            return;
        }

        const logCtx = { userId: user.id, workspaceId: workspace.id, projectId: project.id };

        (async () => {
            const event = await this.projectsService.getRecentWebhookEvent(ctx, user, project);
            if (!event) {
                await this.projectDB.updateProject({
                    id: project.id,
                    settings: {
                        ...project.settings,
                        prebuilds: {
                            ...project.settings?.prebuilds,
                            triggerStrategy: "activity-based",
                        },
                    },
                });
                log.info(logCtx, "Updated project prebuild trigger strategy to 'activity-based'");
            }
        })().catch((err) =>
            log.error(
                { userId: user.id, workspaceId: workspace.id },
                "Failed to update prebuild trigger strategy after workspace creation",
                err,
            ),
        );
    }

    private asyncUpdateDeletionEligibilityTime(userId: string, workspaceId: string, activeNow?: boolean): void {
        this.updateDeletionEligibilityTime(userId, workspaceId, activeNow).catch((err) =>
            log.error({ userId, workspaceId }, "Failed to update deletion eligibility time", err),
        );
    }

    /**
     * Sets the deletionEligibilityTime of the workspace, depending on the current state of the workspace and the configuration.
     *
     * @param userId the user to act as
     * @param workspaceId the workspace to update
     * @returns
     */
    async updateDeletionEligibilityTime(userId: string, workspaceId: string, activeNow = false): Promise<void> {
        try {
            let daysToLive = this.config.workspaceGarbageCollection?.minAgeDays || 14;
            const daysToLiveForPrebuilds = this.config.workspaceGarbageCollection?.minAgePrebuildDays || 7;

            const workspace = await this.doGetWorkspace(userId, workspaceId);
            const instance = await this.db.findCurrentInstance(workspaceId);
            const lastActive =
                instance?.stoppingTime || instance?.startedTime || instance?.creationTime || workspace?.creationTime;
            if (!lastActive && !activeNow) {
                log.warn(
                    { userId, workspaceId },
                    "[updateDeletionEligibilityTime] No last active time found, skipping update of deletion eligibility time",
                    {
                        workspace,
                        instance,
                    },
                );
                return;
            }
            const deletionEligibilityTime = activeNow ? new Date() : new Date(lastActive);
            if (workspace.type === "prebuild") {
                // set to last active plus daysToLiveForPrebuilds as iso string
                deletionEligibilityTime.setDate(deletionEligibilityTime.getDate() + daysToLiveForPrebuilds);
                await this.db.updatePartial(workspaceId, {
                    deletionEligibilityTime: deletionEligibilityTime.toISOString(),
                });
                return;
            }
            // workspaces with pending changes live twice as long
            const hasGitChanges =
                instance?.gitStatus?.totalUncommitedFiles ||
                0 > 0 ||
                instance?.gitStatus?.totalUnpushedCommits ||
                0 > 0 ||
                instance?.gitStatus?.totalUntrackedFiles ||
                0 > 0;
            if (hasGitChanges) {
                daysToLive = daysToLive * 2;
            }
            deletionEligibilityTime.setDate(deletionEligibilityTime.getDate() + daysToLive);
            if (new Date().toISOString() > deletionEligibilityTime.toISOString()) {
                log.warn(
                    { userId, workspaceId, instanceId: instance?.id },
                    "[updateDeletionEligibilityTime] Prevented moving deletion eligibility time to the past",
                    {
                        hasGitChanges,
                        timestamps: new TrustedValue({
                            wouldBeDeletionEligibilityTime: deletionEligibilityTime.toISOString(),
                            currentDeletionEligibilityTime: workspace.deletionEligibilityTime,
                            instanceStoppingTime: instance?.stoppingTime,
                            instanceStartedTime: instance?.startedTime,
                            instanceCreationTime: instance?.creationTime,
                            workspaceCreationTime: workspace.creationTime,
                            lastActive,
                        }),
                    },
                );
                return;
            }

            log.info(
                { userId, workspaceId, instanceId: instance?.id },
                "[updateDeletionEligibilityTime] Updating deletion eligibility time for regular workspace",
                {
                    hasGitChanges,
                    timestamps: new TrustedValue({
                        deletionEligibilityTime: deletionEligibilityTime.toISOString(),
                        instanceStoppingTime: instance?.stoppingTime,
                        instanceStartedTime: instance?.startedTime,
                        instanceCreationTime: instance?.creationTime,
                        workspaceCreationTime: workspace.creationTime,
                        lastActive,
                    }),
                },
            );
            await this.db.updatePartial(workspaceId, {
                deletionEligibilityTime: deletionEligibilityTime.toISOString(),
            });
        } catch (error) {
            log.error(
                { userId, workspaceId },
                "[updateDeletionEligibilityTime] Failed to update deletion eligibility time",
                error,
            );
        }
    }

    /**
     * This method does nothing beyond marking the given workspace as 'softDeleted' with the given cause and sets the 'softDeletedTime' to now.
     * The actual deletion happens as part of the regular workspace garbage collection.
     * @param ctx
     * @param ws
     * @param softDeleted
     */
    async deleteWorkspace(
        userId: string,
        workspaceId: string,
        softDeleted: WorkspaceSoftDeletion = "user",
    ): Promise<void> {
        await this.auth.checkPermissionOnWorkspace(userId, "delete", workspaceId);

        await this.stopWorkspace(userId, workspaceId, "deleted via WorkspaceService");
        await this.db.updatePartial(workspaceId, {
            softDeleted,
            softDeletedTime: new Date().toISOString(),
        });
    }

    /**
     * This *hard deletes* the workspace entry and all corresponding workspace-instances, by triggering a periodic deleter mechanism that purges it from the DB.
     * Note: when this function returns that doesn't mean that the entries are actually gone yet, that might still take a short while until periodic deleter comes
     *       around to deleting them.
     * @param ctx
     * @param userId
     * @param workspaceId
     */
    public async hardDeleteWorkspace(userId: string, workspaceId: string): Promise<void> {
        await this.auth.checkPermissionOnWorkspace(userId, "delete", workspaceId);

        const workspace = await this.db.findById(workspaceId);
        if (!workspace) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Workspace not found.");
        }
        const orgId = workspace.organizationId;
        const ownerId = workspace.ownerId;
        try {
            await this.db.transaction(async (db) => {
                await this.db.hardDeleteWorkspace(workspaceId);
                if (orgId && ownerId && workspaceId) {
                    await this.auth.removeWorkspaceFromOrg(orgId, ownerId, workspaceId);
                }
            });
        } catch (err) {
            if (orgId && ownerId && workspace) {
                await this.auth.addWorkspaceToOrg(orgId, ownerId, workspaceId, !!workspace.shareable);
            }
            throw err;
        }
        log.info(`Purged Workspace ${workspaceId} and all WorkspaceInstances for this workspace`, { workspaceId });
    }

    public async getOpenPorts(userId: string, workspaceId: string): Promise<WorkspaceInstancePort[]> {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);

        const instance = await this.getCurrentInstance(userId, workspaceId);
        const req = new DescribeWorkspaceRequest();
        req.setId(instance.id);
        const client = await this.clientProvider.get(instance.region);
        const desc = await client.describeWorkspace({}, req);

        if (!desc.hasStatus()) {
            // This may happen if the instance is not "runing"
            throw new ApplicationError(ErrorCodes.CONFLICT, "describeWorkspace returned no status");
        }

        const status = desc.getStatus()!;
        const ports = status
            .getSpec()!
            .getExposedPortsList()
            .map(
                (p) =>
                    <WorkspaceInstancePort>{
                        port: p.getPort(),
                        url: p.getUrl(),
                        visibility: this.portVisibilityFromProto(p.getVisibility()),
                        protocol: this.portProtocolFromProto(p.getProtocol()),
                    },
            );

        return ports;
    }

    public async openPort(
        userId: string,
        workspaceId: string,
        port: WorkspaceInstancePort,
    ): Promise<WorkspaceInstancePort | undefined> {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);

        const instance = await this.getCurrentInstance(userId, workspaceId);
        if (instance.status.phase !== "running") {
            log.debug({ userId, workspaceId }, "Cannot open port for workspace with no running instance", {
                port,
            });
            throw new ApplicationError(ErrorCodes.PRECONDITION_FAILED, "workspace is not running");
        }

        const req = new ControlPortRequest();
        req.setId(instance.id);
        const spec = new PortSpec();
        spec.setPort(port.port);
        if (port.visibility) {
            spec.setVisibility(this.portVisibilityToProto(port.visibility));
        }
        if (port.protocol) {
            spec.setProtocol(this.portProtocolToProto(port.protocol));
        }
        req.setSpec(spec);
        req.setExpose(true);

        try {
            const client = await this.clientProvider.get(instance.region);
            await client.controlPort({}, req);
            return undefined;
        } catch (e) {
            throw mapGrpcError(e);
        }
    }

    public async closePort(userId: string, workspaceId: string, port: number) {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);

        const instance = await this.getCurrentInstance(userId, workspaceId);
        if (instance.status.phase !== "running") {
            log.debug({ userId, workspaceId }, "Cannot close a port for workspace with no running instance", {
                port,
            });
            return;
        }
        const req = new ControlPortRequest();
        req.setId(instance.id);
        const spec = new PortSpec();
        spec.setPort(port);
        req.setSpec(spec);
        req.setExpose(false);

        const client = await this.clientProvider.get(instance.region);
        await client.controlPort({}, req);
    }

    private portVisibilityFromProto(visibility: ProtoPortVisibility): PortVisibility {
        switch (visibility) {
            default: // the default in the protobuf def is: private
            case ProtoPortVisibility.PORT_VISIBILITY_PRIVATE:
                return "private";
            case ProtoPortVisibility.PORT_VISIBILITY_PUBLIC:
                return "public";
        }
    }

    private portVisibilityToProto(visibility: PortVisibility | undefined): ProtoPortVisibility {
        switch (visibility) {
            default: // the default for requests is: private
            case "private":
                return ProtoPortVisibility.PORT_VISIBILITY_PRIVATE;
            case "public":
                return ProtoPortVisibility.PORT_VISIBILITY_PUBLIC;
        }
    }

    private portProtocolFromProto(protocol: ProtoPortProtocol): PortProtocol {
        switch (protocol) {
            default: // the default in the protobuf def is: http
            case ProtoPortProtocol.PORT_PROTOCOL_HTTP:
                return "http";
            case ProtoPortProtocol.PORT_PROTOCOL_HTTPS:
                return "https";
        }
    }

    private portProtocolToProto(protocol: PortProtocol | undefined): ProtoPortProtocol {
        switch (protocol) {
            default: // the default for requests is: http
            case "http":
                return ProtoPortProtocol.PORT_PROTOCOL_HTTP;
            case "https":
                return ProtoPortProtocol.PORT_PROTOCOL_HTTPS;
        }
    }

    // startWorkspace and related methods below
    async startWorkspace(
        ctx: TraceContext,
        user: User,
        workspaceId: string,
        options: StartWorkspaceOptions = {},
        restrictToRegular = true,
    ): Promise<StartWorkspaceResult> {
        await this.auth.checkPermissionOnWorkspace(user.id, "start", workspaceId);

        const { workspace, latestInstance } = await this.getWorkspace(user.id, workspaceId);
        if (latestInstance) {
            if (latestInstance.status.phase !== "stopped") {
                // We already have a running workspace instance
                return {
                    instanceID: latestInstance.id,
                    workspaceURL: latestInstance.ideUrl,
                };
            }
        }

        const mayStartPromise = this.mayStartWorkspace(
            ctx,
            user,
            workspace.organizationId,
            this.db.findRegularRunningInstances(user.id),
        );

        const runningInstance = await this.db.findRunningInstance(workspace.id);
        if (runningInstance) {
            return {
                instanceID: runningInstance.id,
                workspaceURL: runningInstance.ideUrl,
            };
        }

        if (restrictToRegular && workspace.type !== "regular") {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Cannot (re-)start irregular workspace.");
        }

        if (!!workspace.softDeleted) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Workspace not found!");
        }

        const projectPromise = workspace.projectId
            ? ApplicationError.notFoundToUndefined(this.projectsService.getProject(user.id, workspace.projectId, true))
            : Promise.resolve(undefined);

        await mayStartPromise;

        options.region = await this.determineWorkspaceRegion(
            user.id,
            workspaceId,
            options.region || "",
            options.clientRegionCode,
        );

        const orgSettings = await this.orgService.getSettings(user.id, workspace.organizationId);
        if (orgSettings.pinnedEditorVersions) {
            if (!options.ideSettings) {
                options.ideSettings = {};
            }
            options.ideSettings.pinnedIDEversions = orgSettings.pinnedEditorVersions;
        }

        // at this point we're about to actually start a new workspace
        const result = await this.workspaceStarter.startWorkspace(ctx, workspace, user, await projectPromise, options);
        this.asyncUpdateDeletionEligibilityTime(user.id, workspaceId, true);
        return result;
    }

    /**
     * @param ctx
     * @param user
     * @param organizationId
     * @param runningInstances
     * @returns
     */
    private async mayStartWorkspace(
        ctx: TraceContext,
        user: User,
        organizationId: string,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<void> {
        let result: MayStartWorkspaceResult = {};
        if (user.blocked) {
            throw new ApplicationError(ErrorCodes.USER_BLOCKED, `User ${user.id} is blocked`);
        }
        try {
            result = await this.entitlementService.mayStartWorkspace(user, organizationId, runningInstances);
            TraceContext.addNestedTags(ctx, { mayStartWorkspace: { result } });
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementService.mayStartWorkspace error", err);
            TraceContext.setError(ctx, err);
            return; // we don't want to block workspace starts because of internal errors
        }
        if (!!result.needsVerification) {
            throw new ApplicationError(ErrorCodes.NEEDS_VERIFICATION, `Please verify your account.`);
        }
        if (!!result.usageLimitReachedOnCostCenter) {
            throw new ApplicationError(
                ErrorCodes.PAYMENT_SPENDING_LIMIT_REACHED,
                "Increase usage limit and try again.",
                {
                    attributionId: result.usageLimitReachedOnCostCenter,
                },
            );
        }
        if (result.hitParallelWorkspaceLimit) {
            const { max } = result.hitParallelWorkspaceLimit;
            throw new ApplicationError(
                ErrorCodes.TOO_MANY_RUNNING_WORKSPACES,
                `You cannot run more than ${max} workspace${
                    max === 1 ? "" : "s"
                } at the same time as per your organization settings. Please stop a workspace before starting another one.`,
            );
        }
    }

    private async determineWorkspaceRegion(
        userId: string,
        workspaceId: string,
        preference: WorkspaceRegion,
        clientCountryCode: string | undefined,
    ): Promise<WorkspaceRegion> {
        let targetRegion = preference;
        if (!isWorkspaceRegion(preference)) {
            targetRegion = "";
        }

        let guessedRegion = "";
        if (!preference) {
            // Attempt to identify the region based on LoadBalancer headers, if there was no explicit choice on the request.
            // The Client region contains the two letter country code.
            if (clientCountryCode) {
                targetRegion = RegionService.countryCodeToNearestWorkspaceRegion(clientCountryCode);
                guessedRegion = targetRegion;
            }
        }

        const logCtx = { userId, workspaceId };
        log.info(logCtx, "[guessWorkspaceRegion] Workspace with region selection", {
            requested_region: preference,
            client_region_from_header: clientCountryCode,
            guessed_region: guessedRegion,
            result: targetRegion,
        });

        return targetRegion;
    }

    public async setPinned(userId: string, workspaceId: string, pinned: boolean): Promise<void> {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);
        await this.db.updatePartial(workspaceId, { pinned });
    }

    public async setDescription(userId: string, workspaceId: string, description: string) {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);
        await this.db.updatePartial(workspaceId, { description });
    }

    public async updateGitStatus(
        userId: string,
        workspaceId: string,
        gitStatus: Required<WorkspaceInstanceRepoStatus> | undefined,
    ) {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);

        if (!!gitStatus) {
            this.validateGitStatusLength(gitStatus, GIT_STATUS_LENGTH_CAP_BYTES);
        }

        let instance = await this.getCurrentInstance(userId, workspaceId);
        if (WorkspaceInstanceRepoStatus.equals(instance.gitStatus, gitStatus)) {
            return;
        }

        const workspace = await this.doGetWorkspace(userId, workspaceId);
        instance = await this.db.updateInstancePartial(instance.id, { gitStatus });
        await this.updateDeletionEligibilityTime(userId, workspaceId, true);
        await this.publisher.publishInstanceUpdate({
            instanceID: instance.id,
            ownerID: workspace.ownerId,
            workspaceID: workspace.id,
        });
    }

    protected validateGitStatusLength(gitStatus: Required<WorkspaceInstanceRepoStatus>, maxByteLength: number) {
        try {
            const s = JSON.stringify(gitStatus);
            if (Buffer.byteLength(s, "utf8") > maxByteLength) {
                throw new ApplicationError(
                    ErrorCodes.BAD_REQUEST,
                    `gitStatus too long, maximum is ${maxByteLength} bytes`,
                );
            }
        } catch (err) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Invalid gitStatus: " + err.message);
        }
    }

    public async getSupportedWorkspaceClasses(user: { id: string }): Promise<SupportedWorkspaceClass[]> {
        return this.installationService.getInstallationWorkspaceClasses(user.id);
    }

    /**
     *
     * @param userId
     * @param workspaceId
     * @param check TODO(gpl) Remove after FGA rollout
     * @returns
     */
    public async getWorkspaceTimeout(
        userId: string,
        workspaceId: string,
        check: (instance: WorkspaceInstance, workspace: Workspace) => Promise<void> = async () => {},
    ): Promise<GetWorkspaceTimeoutResult> {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);

        const workspace = await this.doGetWorkspace(userId, workspaceId);
        const canChange = await this.entitlementService.maySetTimeout(userId, workspace.organizationId);

        const instance = await this.db.findCurrentInstance(workspaceId);
        if (!instance || instance.status.phase !== "running") {
            log.warn({ userId, workspaceId }, "Can only get keep-alive for running workspaces");
            const duration = WORKSPACE_TIMEOUT_DEFAULT_SHORT;
            return { duration, canChange, humanReadableDuration: goDurationToHumanReadable(duration) };
        }
        await check(instance, workspace);

        const req = new DescribeWorkspaceRequest();
        req.setId(instance.id);
        const client = await this.clientProvider.get(instance.region);
        const desc = await client.describeWorkspace({}, req);
        const duration = desc.getStatus()!.getSpec()!.getTimeout();

        return { duration, canChange, humanReadableDuration: goDurationToHumanReadable(duration) };
    }

    public async setWorkspaceTimeout(
        userId: string,
        workspaceId: string,
        duration: WorkspaceTimeoutDuration,
        check: (instance: WorkspaceInstance, workspace: Workspace) => Promise<void> = async () => {},
    ): Promise<SetWorkspaceTimeoutResult> {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);

        let validatedDuration;
        try {
            validatedDuration = WorkspaceTimeoutDuration.validate(duration);
        } catch (err) {
            throw new ApplicationError(ErrorCodes.INVALID_VALUE, "Invalid duration : " + err.message);
        }

        const workspace = await this.doGetWorkspace(userId, workspaceId);
        if (!(await this.entitlementService.maySetTimeout(userId, workspace.organizationId))) {
            throw new ApplicationError(ErrorCodes.PLAN_PROFESSIONAL_REQUIRED, "Plan upgrade is required");
        }

        const orgSettings = await this.orgService.getSettings(userId, workspace.organizationId);
        if (!!orgSettings.timeoutSettings?.denyUserTimeouts) {
            throw new ApplicationError(
                ErrorCodes.PRECONDITION_FAILED,
                "User timeouts are disabled by organization settings",
            );
        }

        const instance = await this.getCurrentInstance(userId, workspaceId);
        if (instance.status.phase !== "running" || workspace.type !== "regular") {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "Can only set keep-alive for regular, running workspaces");
        }
        await check(instance, workspace);

        const client = await this.clientProvider.get(instance.region);
        const req = new SetTimeoutRequest();
        req.setId(instance.id);
        req.setDuration(validatedDuration);
        await client.setTimeout({}, req);

        return {
            resetTimeoutOnWorkspaces: [workspace.id],
            humanReadableDuration: goDurationToHumanReadable(validatedDuration),
        };
    }

    // TODO(gpl) We probably want to change this method to take a workspaceId instead once we migrate the API
    public async getHeadlessLog(
        userId: string,
        instanceId: string,
        check: (workspace: Workspace) => Promise<void> = async () => {},
    ): Promise<HeadlessLogUrls> {
        const workspace = await this.db.findByInstanceId(instanceId);
        if (!workspace) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace for instanceId ${instanceId} not found`);
        }
        if (workspace.type !== "prebuild" || !workspace.projectId) {
            throw new ApplicationError(ErrorCodes.CONFLICT, `Workspace is not a prebuild`);
        }

        await this.auth.checkPermissionOnProject(userId, "read_prebuild", workspace.projectId);

        const wsiPromise = this.db.findInstanceById(instanceId);
        await check(workspace);

        const instance = await wsiPromise;
        if (!instance) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace instance ${instanceId} not found`);
        }

        const logCtx: LogContext = { instanceId };
        const urls = await this.headlessLogService.getHeadlessLogURLs(logCtx, instance, workspace.ownerId);
        if (!urls || (typeof urls.streams === "object" && Object.keys(urls.streams).length === 0)) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Headless logs for ${instanceId} not found`);
        }
        return urls;
    }

    // TODO(gpl) We probably want to change this method to take a workspaceId instead once we migrate the API
    public async getHeadlessLogDownloadUrl(
        userId: string,
        instanceId: string,
        taskId: string,
        check: () => Promise<void> = async () => {},
    ): Promise<string> {
        const workspace = await this.db.findByInstanceId(instanceId);
        if (!workspace) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace for instanceId ${instanceId} not found`);
        }
        if (workspace.type !== "prebuild" || !workspace.projectId) {
            throw new ApplicationError(ErrorCodes.CONFLICT, `Workspace is not a prebuild, or missing projectId`);
        }

        await this.auth.checkPermissionOnProject(userId, "read_prebuild", workspace.projectId);
        const wsiPromise = this.db.findInstanceById(instanceId);
        await check();

        const instance = await wsiPromise;
        if (!instance) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace instance ${instanceId} not found`);
        }

        const downloadUrl = await this.headlessLogService.getHeadlessLogDownloadUrl(
            userId,
            instance,
            workspace.ownerId,
            taskId,
        );
        return downloadUrl;
    }

    // TODO(gpl) We probably want to change this method to take a workspaceId instead once we migrate the API
    public async streamWorkspaceLogs(
        userId: string,
        instanceId: string,
        taskIdentifier: { terminalId: string } | { taskId: string },
        sink: (chunk: Uint8Array) => Promise<void>,
        check: () => Promise<void> = async () => {},
    ) {
        const workspace = await this.db.findByInstanceId(instanceId);
        if (!workspace) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace for instanceId ${instanceId} not found`);
        }
        if (!workspace.projectId) {
            throw new ApplicationError(ErrorCodes.CONFLICT, `Workspace is missing projectId`);
        }

        // TODO Use doGetworkspace for this after we switched to workspaceId!
        if (workspace?.type === "prebuild" && workspace.projectId) {
            await this.auth.checkPermissionOnProject(userId, "read_prebuild", workspace.projectId);
        } else {
            await this.auth.checkPermissionOnWorkspace(userId, "access", workspace.id);
        }

        const wsiPromise = this.db.findInstanceById(instanceId);
        await check();

        const instance = await wsiPromise;
        if (!instance) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace instance ${instanceId} not found`);
        }

        const logEndpoint = HeadlessLogEndpoint.fromWithOwnerToken(instance);
        await this.headlessLogService.streamWorkspaceLogWhileRunning(
            { userId, instanceId, workspaceId: workspace!.id },
            logEndpoint,
            instanceId,
            taskIdentifier,
            sink,
        );
    }

    public watchWorkspaceStatus(userId: string, opts: { signal: AbortSignal }): AsyncIterable<WorkspaceInstance> {
        return generateAsyncGenerator<WorkspaceInstance>((sink) => {
            try {
                const dispose = this.subscriber.listenForWorkspaceInstanceUpdates(userId, (_ctx, instance) => {
                    sink.push(instance);
                });
                return () => {
                    dispose.dispose();
                };
            } catch (e) {
                if (e instanceof Error) {
                    sink.fail(e);
                    return;
                } else {
                    sink.fail(new Error(String(e) || "unknown"));
                }
            }
        }, opts);
    }

    public async *getAndWatchWorkspaceStatus(
        userId: string,
        workspaceId: string | undefined,
        opts: { signal: AbortSignal; skipPermissionCheck?: boolean },
    ) {
        if (workspaceId) {
            const instance = await this.getCurrentInstance(userId, workspaceId, {
                skipPermissionCheck: opts.skipPermissionCheck,
            });
            const status = this.apiConverter.toWorkspace(instance).status;
            if (status) {
                const response = new WatchWorkspaceStatusResponse();
                response.workspaceId = instance.workspaceId;
                response.status = status;
                yield response;
            }
        } else {
            // we initially send an empty status update to let clients know the connection is alive
            yield {} as WatchWorkspaceStatusResponse;
        }
        const it = this.watchWorkspaceStatus(userId, opts);
        for await (const instance of it) {
            if (!instance) {
                continue;
            }
            if (workspaceId && instance.workspaceId !== workspaceId) {
                continue;
            }
            const status = this.apiConverter.toWorkspace(instance).status;
            if (!status) {
                continue;
            }
            const response = new WatchWorkspaceStatusResponse();
            response.workspaceId = instance.workspaceId;
            response.status = status;
            yield response;
        }
    }

    public async watchWorkspaceImageBuildLogs(
        userId: string,
        workspaceId: string,
        receiver: (chunk: Uint8Array) => Promise<void>,
    ): Promise<void> {
        // check access
        await this.getWorkspace(userId, workspaceId);
        const logCtx: LogContext = { userId, workspaceId };
        let instance = await this.db.findCurrentInstance(workspaceId);
        if (!instance || instance.status.phase === "stopped") {
            log.debug(logCtx, `No running instance for workspaceId.`);
            return;
        }

        // wait for up to 20s for imageBuildLogInfo to appear due to:
        //  - db-sync round-trip times
        //  - but also: wait until the image build actually started (image pull!), and log info is available!
        for (let i = 0; i < 10; i++) {
            if (instance.imageBuildInfo?.log) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const wsi = await this.db.findInstanceById(instance.id);
            if (!wsi || !["preparing", "building"].includes(wsi.status.phase)) {
                log.debug(logCtx, `imagebuild logs: instance is not/no longer in 'building' state`, {
                    phase: wsi?.status.phase,
                });
                return;
            }
            instance = wsi as WorkspaceInstance; // help the compiler a bit
        }

        const logInfo = instance.imageBuildInfo?.log;
        if (!logInfo) {
            log.error(logCtx, "cannot watch imagebuild logs for workspaceId: no image build info available");
            throw new ApplicationError(
                ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE,
                "cannot watch imagebuild logs for workspaceId",
            );
        }

        const aborted = new Deferred<boolean>();
        try {
            const logEndpoint: HeadlessLogEndpoint = {
                url: logInfo.url,
                headers: logInfo.headers,
            };
            await this.headlessLogService.streamImageBuildLog(logCtx, logEndpoint, async (chunk) => {
                if (aborted.isResolved) {
                    return;
                }

                try {
                    await receiver(chunk);
                } catch (err) {
                    log.error("error while streaming imagebuild logs", err);
                    aborted.resolve(true);
                }
            });
        } catch (err) {
            // This error is most likely a temporary one (too early). We defer to the client whether they want to keep on trying or not.
            log.debug(logCtx, "cannot watch imagebuild logs for workspaceId", err);
            throw new ApplicationError(
                ErrorCodes.HEADLESS_LOG_NOT_YET_AVAILABLE,
                "cannot watch imagebuild logs for workspaceId",
            );
        } finally {
            aborted.resolve(false);
        }
    }

    public async sendHeartBeat(
        userId: string,
        options: GitpodServer.SendHeartBeatOptions,
        check: (instance: WorkspaceInstance, workspace: Workspace) => Promise<void> = async () => {},
    ): Promise<void> {
        const instanceId = options.instanceId;
        const instance = await this.db.findInstanceById(instanceId);
        if (!instance) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "workspace does not exist");
        }
        const workspaceId = instance.workspaceId;
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);

        try {
            const workspace = await this.doGetWorkspace(userId, workspaceId);
            await check(instance, workspace);

            const wasClosed = options.wasClosed ?? false;
            await this.db.updateLastHeartbeat(instanceId, userId, new Date(), wasClosed);

            const req = new MarkActiveRequest();
            req.setId(instanceId);
            req.setClosed(wasClosed);

            const client = await this.clientProvider.get(instance.region);
            await client.markActive({}, req);
        } catch (e) {
            if (e.message && typeof e.message === "string" && (e.message as String).endsWith("does not exist")) {
                // This is an old tab with open workspace: drop silently
                return;
            } else {
                e = mapGrpcError(e);
                throw e;
            }
        }
    }

    public async controlAdmission(
        userId: string,
        workspaceId: string,
        level: "owner" | "everyone",
        check: (workspace: Workspace, instance?: WorkspaceInstance) => Promise<void> = async () => {},
    ): Promise<void> {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);

        const lvlmap = new Map<string, AdmissionLevel>();
        lvlmap.set("owner", AdmissionLevel.ADMIT_OWNER_ONLY);
        lvlmap.set("everyone", AdmissionLevel.ADMIT_EVERYONE);
        if (!lvlmap.has(level)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Invalid admission level.");
        }

        const workspace = await this.doGetWorkspace(userId, workspaceId);
        await check(workspace);

        if (level !== "owner" && workspace.organizationId) {
            const settings = await this.orgService.getSettings(userId, workspace.organizationId);
            if (settings?.workspaceSharingDisabled) {
                throw new ApplicationError(
                    ErrorCodes.PERMISSION_DENIED,
                    "An Organization Owner has disabled workspace sharing for workspaces in this Organization. ",
                );
            }
        }

        const instance = await this.db.findCurrentInstance(workspaceId);
        if (instance && instance.status.phase === "running") {
            await check(workspace, instance);

            const req = new ControlAdmissionRequest();
            req.setId(instance.id);
            req.setLevel(lvlmap.get(level)!);

            const client = await this.clientProvider.get(instance.region);
            await client.controlAdmission({}, req);
        }
        log.info({ userId, workspaceId }, "Admission level changed", { level });
        await this.db.transaction(async (db) => {
            const shareable = level === "everyone";
            await db.updatePartial(workspaceId, { shareable });
            await this.auth.setWorkspaceIsShared(userId, workspaceId, shareable);
        });
    }

    public async validateImageRef(ctx: TraceContext, user: User, imageRef: string, organizationId?: string) {
        try {
            return await this.workspaceStarter.resolveBaseImage(
                ctx,
                user,
                imageRef,
                undefined,
                undefined,
                undefined,
                organizationId,
            );
        } catch (e) {
            // see https://github.com/gitpod-io/gitpod/blob/f3e41f8d86234e4101edff2199c54f50f8cbb656/components/image-builder-mk3/pkg/orchestrator/orchestrator.go#L561
            // TODO(ak) ideally we won't check a message (subject to change)
            // but ws-manager does not return INTERNAL for invalid image refs provided by a user
            // otherwise we report it as internal error in observability
            const code = e["code"];
            const details = e["details"];
            if (
                typeof details === "string" &&
                (code === grpc.status.INVALID_ARGUMENT || details.includes("cannot resolve image"))
            ) {
                let message = details;
                // strip confusing prefix
                if (details.startsWith("can't resolve base image ref: ")) {
                    message = details.substring("can't resolve base image ref: ".length);
                }
                throw new ApplicationError(ErrorCodes.BAD_REQUEST, message);
            }
            throw e;
        }
    }

    public async getWorkspaceDefaultImage(
        userId: string,
        workspaceId: string,
    ): Promise<{ source: "organization" | "installation"; image: string }> {
        const workspace = await this.doGetWorkspace(userId, workspaceId);
        const settings = await this.orgService.getSettings(userId, workspace.organizationId);
        if (settings.defaultWorkspaceImage) {
            return {
                source: "organization",
                image: settings.defaultWorkspaceImage,
            };
        }
        return {
            source: "installation",
            image: this.config.workspaceDefaults.workspaceImage,
        };
    }

    public async takeSnapshot(userId: string, options: GitpodServer.TakeSnapshotOptions): Promise<Snapshot> {
        const { workspaceId, dontWait } = options;
        await this.auth.checkPermissionOnWorkspace(userId, "create_snapshot", workspaceId);
        const workspace = await this.doGetWorkspace(userId, workspaceId);
        const instance = await this.db.findRunningInstance(workspaceId);
        if (!instance) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} has no running instance`);
        }
        const client = await this.clientProvider.get(instance.region);
        const request = new TakeSnapshotRequest();
        request.setId(instance.id);
        request.setReturnImmediately(true);

        // this triggers the snapshots, but returns early! cmp. waitForSnapshot to wait for it's completion
        let snapshotUrl;
        try {
            const resp = await client.takeSnapshot({}, request);
            snapshotUrl = resp.getUrl();
        } catch (err) {
            if (isClusterMaintenanceError(err)) {
                throw new ApplicationError(
                    ErrorCodes.PRECONDITION_FAILED,
                    "Cannot take a snapshot because the workspace cluster is under maintenance. Please try again in a few minutes",
                );
            }
            throw err;
        }
        const snapshot = await this.snapshotService.createSnapshot(options, snapshotUrl);

        // to be backwards compatible during rollout, we require new clients to explicitly pass "dontWait: true"
        // TODO: remove wait option after migrate to gRPC
        const waitOpts = { workspaceOwner: workspace.ownerId, snapshot };
        if (!dontWait) {
            await this.snapshotService.waitForSnapshot(waitOpts);
        } else {
            this.snapshotService
                .waitForSnapshot(waitOpts)
                .catch((err) => log.error({ userId, workspaceId }, "internalDoWaitForWorkspace", err));
        }
        return snapshot;
    }

    /**
     * @throws ApplicationError with either NOT_FOUND or SNAPSHOT_ERROR in case the snapshot is not done yet.
     */
    public async waitForSnapshot(userId: string, snapshotId: string): Promise<void> {
        const snapshot = await this.db.findSnapshotById(snapshotId);
        if (!snapshot) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `No snapshot with id '${snapshotId}' found.`);
        }
        await this.auth.checkPermissionOnWorkspace(userId, "create_snapshot", snapshot.originalWorkspaceId);
        const workspace = await this.doGetWorkspace(userId, snapshot.originalWorkspaceId);
        await this.snapshotService.waitForSnapshot({ workspaceOwner: workspace.ownerId, snapshot });
    }

    async listSnapshots(userId: string, workspaceId: string): Promise<Snapshot[]> {
        // guard if user has workspace get permission
        await this.doGetWorkspace(userId, workspaceId);
        return await this.db.findSnapshotsByWorkspaceId(workspaceId);
    }
}

// TODO(gpl) Make private after FGA rollout
export function mapGrpcError(err: any): Error {
    if (!isGrpcError(err)) {
        return err;
    }

    switch (err.code) {
        case grpc.status.RESOURCE_EXHAUSTED:
            return new ApplicationError(ErrorCodes.TOO_MANY_REQUESTS, err.details);
        default:
            return new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, err.details);
    }
}

function scrubValue(value: string | undefined): string | undefined {
    if (value === undefined) {
        return undefined;
    }
    return scrubber.scrubValue(value);
}
