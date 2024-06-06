/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { WorkspaceDB, TeamDB } from "@gitpod/gitpod-db/lib";
import { User, Workspace } from "@gitpod/gitpod-protocol";
import { StorageClient } from "../storage/storage-client";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { StopWorkspacePolicy } from "@gitpod/ws-manager/lib";
import { AuthProviderService } from "../auth/auth-provider-service";
import { WorkspaceService } from "../workspace/workspace-service";
import { UserService } from "./user-service";
import { TransactionalContext } from "@gitpod/gitpod-db/lib/typeorm/transactional-db-impl";
import { OrganizationService } from "../orgs/organization-service";

@injectable()
export class UserDeletionService {
    constructor(
        @inject(UserService) private readonly userService: UserService,
        @inject(WorkspaceDB) private readonly workspaceDb: WorkspaceDB,
        @inject(TeamDB) private readonly teamDb: TeamDB,
        @inject(StorageClient) private readonly storageClient: StorageClient,
        @inject(WorkspaceService) private readonly workspaceService: WorkspaceService,
        @inject(AuthProviderService) private readonly authProviderService: AuthProviderService,
        @inject(OrganizationService) private readonly organizationService: OrganizationService,
    ) {
        this.userService.onDeleteUser(async (subjectId, user, ctx) => {
            await this.contributeToDeleteUser(subjectId, user, ctx);
        });
    }

    private async contributeToDeleteUser(userId: string, user: User, ctx: TransactionalContext): Promise<void> {
        // Stop all workspaces
        await this.workspaceService.stopRunningWorkspacesForUser(
            {},
            userId,
            user.id,
            "user deleted",
            StopWorkspacePolicy.IMMEDIATELY,
        );

        // Auth Providers
        const authProviders = await this.authProviderService.getAuthProvidersOfUser(user);
        for (const provider of authProviders) {
            try {
                await this.authProviderService.deleteAuthProviderOfUser(user.id, provider.id);
            } catch (error) {
                log.error({ userId: user.id }, "Failed to delete user's auth provider.", error);
            }
        }

        await Promise.all([
            // Workspace
            this.anonymizeAllWorkspaces(user.id),
            // Bucket
            this.deleteUserBucket(user.id),
            // Teams owned only by this user
            this.deleteSoleOwnedTeams(user.id),
            // Team memberships
            this.deleteTeamMemberships(user.id),
        ]);
    }

    private async anonymizeAllWorkspaces(userId: string) {
        const workspaces = await this.workspaceDb.findWorkspacesByUser(userId);

        await Promise.all(
            workspaces.map(async (ws) => {
                this.anonymizeWorkspace(ws);
                await this.workspaceDb.store(ws);
            }),
        );
    }

    private async deleteUserBucket(userId: string) {
        try {
            await this.storageClient.deleteUserContent(userId);
        } catch (error) {
            log.error({ userId }, "Failed to delete user bucket.", error);
        }
    }

    private async deleteTeamMemberships(userId: string) {
        const teams = await this.teamDb.findTeamsByUser(userId);
        await Promise.all(teams.map((t) => this.teamDb.removeMemberFromTeam(userId, t.id)));
    }

    private async deleteSoleOwnedTeams(userId: string) {
        const ownedTeams = await this.teamDb.findTeamsByUserAsSoleOwner(userId);
        await Promise.all(ownedTeams.map((t) => this.organizationService.deleteOrganization(userId, t.id)));
    }

    private anonymizeWorkspace(ws: Workspace) {
        ws.context.title = "deleted-title";
        ws.context.normalizedContextURL = "deleted-normalizedContextURL";
        ws.contextURL = "deleted-contextURL";
        ws.description = "deleted-description";
        ws.context = {} as any;
    }
}
