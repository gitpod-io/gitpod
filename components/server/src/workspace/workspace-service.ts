/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import * as grpc from "@grpc/grpc-js";
import { RedisPublisher, WorkspaceDB } from "@gitpod/gitpod-db/lib";
import {
    GetWorkspaceTimeoutResult,
    GitpodClient,
    GitpodServer,
    HeadlessLogUrls,
    PortProtocol,
    PortVisibility,
    Project,
    SetWorkspaceTimeoutResult,
    StartWorkspaceResult,
    User,
    WORKSPACE_TIMEOUT_DEFAULT_SHORT,
    Workspace,
    WorkspaceContext,
    WorkspaceImageBuild,
    WorkspaceInfo,
    WorkspaceInstance,
    WorkspaceInstancePort,
    WorkspaceInstanceRepoStatus,
    WorkspaceSoftDeletion,
    WorkspaceTimeoutDuration,
} from "@gitpod/gitpod-protocol";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
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
} from "@gitpod/ws-manager/lib";
import { WorkspaceStarter, StartWorkspaceOptions as StarterStartWorkspaceOptions } from "./workspace-starter";
import { LogContext, log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { EntitlementService, MayStartWorkspaceResult } from "../billing/entitlement-service";
import * as crypto from "crypto";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { WorkspaceRegion, isWorkspaceRegion } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { RegionService } from "./region-service";
import { ProjectsService } from "../projects/projects-service";
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import { SupportedWorkspaceClass } from "@gitpod/gitpod-protocol/lib/workspace-class";
import { Config } from "../config";
import { goDurationToHumanReadable } from "@gitpod/gitpod-protocol/lib/util/timeutil";
import { HeadlessLogEndpoint, HeadlessLogService } from "./headless-log-service";
import { Deferred } from "@gitpod/gitpod-protocol/lib/util/deferred";
import { OrganizationService } from "../orgs/organization-service";
import { isGrpcError } from "@gitpod/gitpod-protocol/lib/util/grpc";

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
        @inject(RedisPublisher) private readonly publisher: RedisPublisher,
        @inject(HeadlessLogService) private readonly headlessLogService: HeadlessLogService,
        @inject(Authorizer) private readonly auth: Authorizer,
    ) {}

    async createWorkspace(
        ctx: TraceContext,
        user: User,
        organizationId: string,
        project: Project | undefined,
        context: WorkspaceContext,
        normalizedContextURL: string,
    ): Promise<Workspace> {
        await this.auth.checkPermissionOnOrganization(user.id, "create_workspace", organizationId);

        // We don't want to be doing this in a transaction, because it calls out to external systems.
        // TODO(gpl) Would be great to sepearate workspace creation from external calls
        const workspace = await this.factory.createForContext(
            ctx,
            user,
            organizationId,
            project,
            context,
            normalizedContextURL,
        );

        // Instead, we fall back to removing access in case something goes wrong.
        try {
            await this.auth.addWorkspaceToOrg(organizationId, user.id, workspace.id, !!workspace.shareable);
        } catch (err) {
            await this.hardDeleteWorkspace(user.id, workspace.id).catch((err) =>
                log.error("failed to hard-delete workspace", err),
            );
            throw err;
        }

        return workspace;
    }

    async getWorkspace(userId: string, workspaceId: string): Promise<WorkspaceInfo> {
        const workspace = await this.doGetWorkspace(userId, workspaceId);

        const latestInstancePromise = this.db.findCurrentInstance(workspaceId);
        const latestInstance = await latestInstancePromise;

        return {
            workspace,
            latestInstance,
        };
    }

    async getWorkspaces(userId: string, options: GitpodServer.GetWorkspacesOptions): Promise<WorkspaceInfo[]> {
        const res = await this.db.find({
            limit: 20,
            ...options,
            userId, // gpl: We probably want to removed this limitation in the future, butkeeping the old behavior for now due to focus on FGA
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

    async getCurrentInstance(userId: string, workspaceId: string): Promise<WorkspaceInstance> {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);
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
    ): Promise<void> {
        await this.auth.checkPermissionOnWorkspace(userId, "stop", workspaceId);

        const workspace = await this.doGetWorkspace(userId, workspaceId);
        const instance = await this.db.findRunningInstance(workspace.id);
        if (!instance) {
            // there's no instance running - we're done
            return;
        }
        await this.workspaceStarter.stopWorkspaceInstance({}, instance.id, instance.region, reason, policy);
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
            }),
        );
        return infos.map((instance) => instance.workspace);
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
            return;
        }

        const req = new ControlPortRequest();
        req.setId(instance.id);
        const spec = new PortSpec();
        spec.setPort(port.port);
        spec.setVisibility(this.portVisibilityToProto(port.visibility));
        spec.setProtocol(this.portProtocolToProto(port.protocol));
        req.setSpec(spec);
        req.setExpose(true);

        try {
            const client = await this.clientProvider.get(instance.region);
            await client.controlPort({}, req);
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
            ? ApplicationError.notFoundToUndefined(this.projectsService.getProject(user.id, workspace.projectId))
            : Promise.resolve(undefined);

        await mayStartPromise;

        options.region = await this.determineWorkspaceRegion(
            user.id,
            workspaceId,
            options.region || "",
            options.clientRegionCode,
        );

        // at this point we're about to actually start a new workspace
        const result = await this.workspaceStarter.startWorkspace(ctx, workspace, user, await projectPromise, options);
        return result;
    }

    /**
     * @deprecated TODO (gpl) This should be private, but in favor of smaller PRs, will be public for now.
     * @param ctx
     * @param user
     * @param organizationId
     * @param runningInstances
     * @returns
     */
    public async mayStartWorkspace(
        ctx: TraceContext,
        user: User,
        organizationId: string,
        runningInstances: Promise<WorkspaceInstance[]>,
    ): Promise<void> {
        let result: MayStartWorkspaceResult = {};
        try {
            result = await this.entitlementService.mayStartWorkspace(user, organizationId, runningInstances);
            TraceContext.addNestedTags(ctx, { mayStartWorkspace: { result } });
        } catch (err) {
            log.error({ userId: user.id }, "EntitlementSerivce.mayStartWorkspace error", err);
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
        if (!!result.hitParallelWorkspaceLimit) {
            throw new ApplicationError(
                ErrorCodes.TOO_MANY_RUNNING_WORKSPACES,
                `You cannot run more than ${result.hitParallelWorkspaceLimit.max} workspaces at the same time. Please stop a workspace before starting another one.`,
            );
        }
    }

    private async determineWorkspaceRegion(
        userId: string,
        workspaceId: string,
        preference: WorkspaceRegion,
        clientCountryCode: string | undefined,
    ): Promise<WorkspaceRegion> {
        const guessWorkspaceRegionEnabled = await getExperimentsClientForBackend().getValueAsync(
            "guessWorkspaceRegion",
            false,
            {
                user: { id: userId || "" },
            },
        );

        const regionLogContext = {
            requested_region: preference,
            client_region_from_header: clientCountryCode,
            experiment_enabled: false,
            guessed_region: "",
        };

        let targetRegion = preference;
        if (!isWorkspaceRegion(preference)) {
            targetRegion = "";
        } else {
            targetRegion = preference;
        }

        if (guessWorkspaceRegionEnabled) {
            regionLogContext.experiment_enabled = true;

            if (!preference) {
                // Attempt to identify the region based on LoadBalancer headers, if there was no explicit choice on the request.
                // The Client region contains the two letter country code.
                if (clientCountryCode) {
                    targetRegion = RegionService.countryCodeToNearestWorkspaceRegion(clientCountryCode);
                    regionLogContext.guessed_region = targetRegion;
                }
            }
        }

        const logCtx = { userId, workspaceId };
        log.info(logCtx, "[guessWorkspaceRegion] Workspace with region selection", regionLogContext);

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

        let instance = await this.getCurrentInstance(userId, workspaceId);
        if (WorkspaceInstanceRepoStatus.equals(instance.gitStatus, gitStatus)) {
            return;
        }

        const workspace = await this.doGetWorkspace(userId, workspaceId);
        instance = await this.db.updateInstancePartial(instance.id, { gitStatus });
        await this.publisher.publishInstanceUpdate({
            instanceID: instance.id,
            ownerID: workspace.ownerId,
            workspaceID: workspace.id,
        });
    }

    public async getSupportedWorkspaceClasses(userId: string): Promise<SupportedWorkspaceClass[]> {
        // No access check required, valid session/user is enough
        const classes = this.config.workspaceClasses.map((c) => ({
            id: c.id,
            category: c.category,
            displayName: c.displayName,
            description: c.description,
            powerups: c.powerups,
            isDefault: c.isDefault,
        }));
        return classes;
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
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Prebuild for instanceId ${instanceId} not found`);
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

    public async watchWorkspaceImageBuildLogs(
        userId: string,
        workspaceId: string,
        client: Pick<GitpodClient, "onWorkspaceImageBuildLogs">,
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
            let lineCount = 0;
            await this.headlessLogService.streamImageBuildLog(
                logCtx,
                logEndpoint,
                async (chunk) => {
                    if (aborted.isResolved) {
                        return;
                    }

                    try {
                        chunk = chunk.replace("\n", WorkspaceImageBuild.LogLine.DELIMITER);
                        lineCount += chunk.split(WorkspaceImageBuild.LogLine.DELIMITER_REGEX).length;

                        client.onWorkspaceImageBuildLogs(undefined as any, {
                            text: chunk,
                            isDiff: true,
                            upToLine: lineCount,
                        });
                    } catch (err) {
                        log.error("error while streaming imagebuild logs", err);
                        aborted.resolve(true);
                    }
                },
                aborted,
            );
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

            const wasClosed = !!(options && options.wasClosed);
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

    public async resolveBaseImage(ctx: TraceContext, user: User, imageRef: string) {
        try {
            return await this.workspaceStarter.resolveBaseImage(ctx, user, imageRef);
        } catch (e) {
            // we could map proper response message according to e.code
            // see https://github.com/gitpod-io/gitpod/blob/ef95e6f3ca0bf314c40da1b83251423c2208d175/components/image-builder-mk3/pkg/orchestrator/orchestrator_test.go#L178
            throw ApplicationError.fromGRPCError(e);
        }
    }
}

// TODO(gpl) Make private after FGA rollout
export function mapGrpcError(err: Error): Error {
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
