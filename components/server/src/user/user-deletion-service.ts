/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable, inject } from "inversify";
import { UserDB, WorkspaceDB, TeamDB, ProjectDB } from "@gitpod/gitpod-db/lib";
import { User, Workspace } from "@gitpod/gitpod-protocol";
import { StorageClient } from "../storage/storage-client";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { StopWorkspacePolicy } from "@gitpod/ws-manager/lib";
import { AuthProviderService } from "../auth/auth-provider-service";
import { IAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { WorkspaceStarter } from "../workspace/workspace-starter";

@injectable()
export class UserDeletionService {
    constructor(
        @inject(UserDB) private readonly db: UserDB,
        @inject(WorkspaceDB) private readonly workspaceDb: WorkspaceDB,
        @inject(TeamDB) private readonly teamDb: TeamDB,
        @inject(ProjectDB) private readonly projectDb: ProjectDB,
        @inject(StorageClient) private readonly storageClient: StorageClient,
        @inject(WorkspaceStarter) private readonly workspaceStarter: WorkspaceStarter,
        @inject(AuthProviderService) private readonly authProviderService: AuthProviderService,
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
    ) {}

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
        await this.workspaceStarter.stopRunningWorkspacesForUser(
            {},
            user.id,
            "user deleted",
            StopWorkspacePolicy.IMMEDIATELY,
        );

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
            user.lastVerificationTime = undefined;
            user.markedDeleted = true;
            await db.storeUser(user);
        });

        await Promise.all([
            // Workspace
            this.anonymizeAllWorkspaces(id),
            // Bucket
            this.deleteUserBucket(id),
            // Teams owned only by this user
            this.deleteSoleOwnedTeams(id),
            // Team memberships
            this.deleteTeamMemberships(id),
        ]);

        // Track the deletion Event for Analytics Purposes
        this.analytics.track({
            userId: user.id,
            event: "deletion",
            properties: {
                deleted_at: new Date().toISOString(),
            },
        });
        this.analytics.identify({
            userId: user.id,
            traits: {
                github_slug: "deleted-user",
                gitlab_slug: "deleted-user",
                bitbucket_slug: "deleted-user",
                email: "deleted-user",
                full_name: "deleted-user",
                name: "deleted-user",
            },
        });
    }

    private anonymizeUser(user: User) {
        user.avatarUrl = "deleted-avatarUrl";
        user.fullName = "deleted-fullName";
        user.name = "deleted-Name";
        if (user.verificationPhoneNumber) {
            user.verificationPhoneNumber = "deleted-phoneNumber";
        }
    }

    private deleteIdentities(user: User) {
        for (const identity of user.identities) {
            identity.deleted = true; // This triggers the HARD DELETION of the identity
        }
    }

    private async deleteTokens(db: UserDB, user: User) {
        const tokenDeletions = user.identities.map((identity) => db.deleteTokens(identity));
        await Promise.all(tokenDeletions);
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

        for (const team of ownedTeams) {
            const teamProjects = await this.projectDb.findProjects(team.id);
            await Promise.all(teamProjects.map((project) => this.projectDb.markDeleted(project.id)));
        }

        await Promise.all(ownedTeams.map((t) => this.teamDb.deleteTeam(t.id)));
    }

    anonymizeWorkspace(ws: Workspace) {
        ws.context.title = "deleted-title";
        ws.context.normalizedContextURL = "deleted-normalizedContextURL";
        ws.contextURL = "deleted-contextURL";
        ws.description = "deleted-description";
        ws.context = {} as any;
    }
}
