/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { WorkspaceDB } from "@gitpod/gitpod-db/lib";
import {
    GitpodServer,
    Project,
    StartWorkspaceResult,
    User,
    Workspace,
    WorkspaceContext,
    WorkspaceInstance,
    WorkspaceSoftDeletion,
} from "@gitpod/gitpod-protocol";
import { ErrorCodes, ApplicationError } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { Authorizer } from "../authorization/authorizer";
import { TraceContext } from "@gitpod/gitpod-protocol/lib/util/tracing";
import { WorkspaceFactory } from "./workspace-factory";
import { StopWorkspacePolicy } from "@gitpod/ws-manager/lib";
import { WorkspaceStarter } from "./workspace-starter";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { EntitlementService, MayStartWorkspaceResult } from "../billing/entitlement-service";
import * as crypto from "crypto";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { WorkspaceRegion, isWorkspaceRegion } from "@gitpod/gitpod-protocol/lib/workspace-cluster";
import { RegionService } from "./region-service";
import { ProjectsService } from "../projects/projects-service";
import { EnvVarService } from "./env-var-service";

@injectable()
export class WorkspaceService {
    constructor(
        @inject(WorkspaceFactory) private readonly factory: WorkspaceFactory,
        @inject(WorkspaceStarter) private readonly workspaceStarter: WorkspaceStarter,
        @inject(WorkspaceDB) private readonly db: WorkspaceDB,
        @inject(EntitlementService) private readonly entitlementService: EntitlementService,
        @inject(EnvVarService) private readonly envVarService: EnvVarService,
        @inject(ProjectsService) private readonly projectsService: ProjectsService,
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
            await this.auth.addWorkspaceToOrg(organizationId, user.id, workspace.id);
        } catch (err) {
            await this.hardDeleteWorkspace(user.id, workspace.id).catch((err) =>
                log.error("failed to hard-delete workspace", err),
            );
            throw err;
        }

        return workspace;
    }

    async getWorkspace(userId: string, workspaceId: string): Promise<Workspace> {
        return this.doGetWorkspace(userId, workspaceId);
    }

    // Internal method for allowing for additional DBs to be passed in
    private async doGetWorkspace(userId: string, workspaceId: string, db: WorkspaceDB = this.db): Promise<Workspace> {
        await this.auth.checkPermissionOnWorkspace(userId, "access", workspaceId);

        const workspace = await db.findById(workspaceId);
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

        const ws = await this.getWorkspace(userId, workspaceId);
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

        const workspace = await this.getWorkspace(userId, workspaceId);
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

        let orgId: string | undefined = undefined;
        let ownerId: string | undefined = undefined;
        try {
            await this.db.transaction(async (db) => {
                const workspace = await this.db.findById(workspaceId);
                if (!workspace) {
                    throw new ApplicationError(ErrorCodes.NOT_FOUND, "Workspace not found.");
                }
                orgId = workspace.organizationId;
                ownerId = workspace.ownerId;
                await this.db.hardDeleteWorkspace(workspaceId);

                await this.auth.removeWorkspaceFromOrg(orgId, ownerId, workspaceId);
            });
        } catch (err) {
            if (orgId && ownerId) {
                await this.auth.addWorkspaceToOrg(orgId, ownerId, workspaceId);
            }
            throw err;
        }
        log.info(`Purged Workspace ${workspaceId} and all WorkspaceInstances for this workspace`, { workspaceId });
    }

    // startWorkspace and related methods below
    async startWorkspace(
        ctx: TraceContext,
        user: User,
        workspaceId: string,
        options?: GitpodServer.StartWorkspaceOptions,
    ): Promise<StartWorkspaceResult> {
        await this.auth.checkPermissionOnWorkspace(user.id, "start", workspaceId);

        const workspace = await this.doGetWorkspace(user.id, workspaceId);
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

        if (workspace.type !== "regular") {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "Cannot (re-)start irregular workspace.");
        }

        const envVarsPromise = this.envVarService.resolve(workspace);
        const projectPromise = workspace.projectId
            ? ApplicationError.notFoundToUndefined(this.projectsService.getProject(user.id, workspace.projectId))
            : Promise.resolve(undefined);

        await mayStartPromise;

        // at this point we're about to actually start a new workspace
        const result = await this.workspaceStarter.startWorkspace(
            ctx,
            workspace,
            user,
            await projectPromise,
            await envVarsPromise,
            options,
        );
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

    async determineWorkspaceRegion(
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
}
