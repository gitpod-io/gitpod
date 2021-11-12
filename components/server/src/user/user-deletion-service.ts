/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { UserDB, WorkspaceDB, UserStorageResourcesDB, TeamDB, ProjectDB } from '@gitpod/gitpod-db/lib';
import { User, Workspace } from "@gitpod/gitpod-protocol";
import { StorageClient } from "../storage/storage-client";
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { WorkspaceManagerClientProvider } from "@gitpod/ws-manager/lib/client-provider";
import { StopWorkspaceRequest, StopWorkspacePolicy } from "@gitpod/ws-manager/lib";
import { WorkspaceDeletionService } from "../workspace/workspace-deletion-service";
import { AuthProviderService } from "../auth/auth-provider-service";
import { IAnalyticsWriter } from '@gitpod/gitpod-protocol/lib/analytics';
import { Config } from "../config";

@injectable()
export class UserDeletionService {
    @inject(Config) protected readonly config: Config;
    @inject(UserDB) protected readonly db: UserDB;
    @inject(WorkspaceDB) protected readonly workspaceDb: WorkspaceDB;
    @inject(UserStorageResourcesDB) protected readonly userStorageResourcesDb: UserStorageResourcesDB;
    @inject(TeamDB) protected readonly teamDb: TeamDB;
    @inject(ProjectDB) protected readonly projectDb: ProjectDB;
    @inject(StorageClient) protected readonly storageClient: StorageClient;
    @inject(WorkspaceManagerClientProvider) protected readonly workspaceManagerClientProvider: WorkspaceManagerClientProvider;
    @inject(WorkspaceDeletionService) protected readonly workspaceDeletionService: WorkspaceDeletionService;
    @inject(AuthProviderService) protected readonly authProviderService: AuthProviderService;
    @inject(IAnalyticsWriter) protected readonly analytics: IAnalyticsWriter;

    /**
     * This method deletes a User logically. The contract here is that after running this method without receiving an
     * error, the system does not contain any data that is relatable to the actual person in the sense of the GDPR.
     * To guarantee that, but also maintain traceability
     * we anonymize data that might contain user related/relatable data and keep the entities itself (incl. ids).
     */
    async deleteUser(id: string): Promise<void> {
        const user = await this.db.findUserById(id);
        if (!user) {
            throw new Error(`No user with id ${id} found!`);
        }

        if (user.markedDeleted === true) {
            log.debug({ userId: id }, "Is deleted but markDeleted already set. Continuing.");
        }

        // Stop all workspaces
        await this.stopWorkspaces(user);

        // Auth Providers
        const authProviders = await this.authProviderService.getAuthProvidersOfUser(user);
        for (const provider of authProviders) {
            try {
                await this.authProviderService.deleteAuthProvider(provider);
            } catch (error) {
                log.error({ userId: id }, "Failed to delete user's auth provider.", error);
            }
        }

        // User
        await this.db.transaction(async (db) => {
            this.anonymizeUser(user);
            this.deleteIdentities(user);
            await this.deleteTokens(db, user);
            user.markedDeleted = true;
            await db.storeUser(user);
        });

        await Promise.all([
            // Workspace
            this.anonymizeAllWorkspaces(id),
            // UserStorageResourcesDB
            this.userStorageResourcesDb.deleteAllForUser(user.id),
            // Bucket
            this.deleteUserBucket(id),
            // Teams owned only by this user
            this.deleteSoleOwnedTeams(id),
            // Team memberships
            this.deleteTeamMemberships(id),
            // User projects
            this.deleteUserProjects(id),
        ]);

        // Track the deletion Event for Analytics Purposes
        this.analytics.track({
            userId: user.id,
            event: "deletion",
            properties: {
                "deleted_at":new Date().toISOString()
            }
        });
    }

    protected async stopWorkspaces(user: User) {
        const runningWorkspaces = await this.workspaceDb.findRunningInstancesWithWorkspaces(undefined, user.id);

        await Promise.all(runningWorkspaces.map(async wsi => {
            const req = new StopWorkspaceRequest();
            req.setId(wsi.latestInstance.id);
            req.setPolicy(StopWorkspacePolicy.NORMALLY);

            const manager = await this.workspaceManagerClientProvider.get(wsi.latestInstance.region);
            await manager.stopWorkspace({}, req);
        }));
    }

    protected anonymizeUser(user: User) {
        user.avatarUrl = 'deleted-avatarUrl';
        user.fullName = 'deleted-fullName';
        user.name = 'deleted-Name';
    }

    protected deleteIdentities(user: User) {
        for (const identity of user.identities) {
            identity.deleted = true;    // This triggers the HARD DELETION of the identity
        }
    }

    protected async deleteTokens(db: UserDB, user: User) {
        const tokenDeletions = user.identities.map((identity) => db.deleteTokens(identity));
        await Promise.all(tokenDeletions);
    }

    protected async anonymizeAllWorkspaces(userId: string) {
        const workspaces = await this.workspaceDb.findWorkspacesByUser(userId);

        await Promise.all(workspaces.map(ws => async () => {
            this.anonymizeWorkspace(ws);
            await this.workspaceDb.store(ws);
        }));
    }

    protected async deleteUserBucket(userId: string) {
        try {
            await this.storageClient.deleteUserContent(userId);
        } catch (error) {
            log.error({ userId }, "Failed to delete user bucket.", error);
        }
    }

    protected async deleteTeamMemberships(userId: string) {
        const teams = await this.teamDb.findTeamsByUser(userId);
        await Promise.all(teams.map(t => this.teamDb.removeMemberFromTeam(userId, t.id)));
    }

    protected async deleteSoleOwnedTeams(userId: string) {
        const ownedTeams = await this.teamDb.findTeamsByUserAsSoleOwner(userId);

        for (const team of ownedTeams) {
            const teamProjects = await this.projectDb.findTeamProjects(team.id);
            await Promise.all(teamProjects.map(project => this.projectDb.markDeleted(project.id)));
        }

        await Promise.all(ownedTeams.map(t => this.teamDb.deleteTeam(t.id)));
    }

    protected async deleteUserProjects(id: string) {
        const userProjects = await this.projectDb.findUserProjects(id);

        await Promise.all(userProjects.map(project => this.projectDb.markDeleted(project.id)));
    }

    anonymizeWorkspace(ws: Workspace) {
        ws.context.title = 'deleted-title';
        ws.context.normalizedContextURL = 'deleted-normalizedContextURL';
        ws.contextURL = 'deleted-contextURL';
        ws.description = 'deleted-description';
        ws.context = {} as any;
    }
}