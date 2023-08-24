/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";

import { BUILTIN_INSTLLATION_ADMIN_USER_ID } from "@gitpod/gitpod-db/lib";
import { Project, TeamMemberRole } from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import {
    AllResourceTypes,
    InstallationID,
    InstallationPermission,
    OrganizationPermission,
    Permission,
    ProjectPermission,
    Relation,
    ResourceType,
    UserPermission,
    WorkspacePermission,
    rel,
} from "./definitions";
import { SpiceDBAuthorizer } from "./spicedb-authorizer";
import { getExperimentsClientForBackend } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";

export function createInitializingAuthorizer(spiceDbAuthorizer: SpiceDBAuthorizer): Authorizer {
    const target = new Authorizer(spiceDbAuthorizer);
    const initialized = (async () => {
        await target.addInstallationAdminRole(BUILTIN_INSTLLATION_ADMIN_USER_ID);
        await target.addUser(BUILTIN_INSTLLATION_ADMIN_USER_ID);
    })();
    return new Proxy(target, {
        get(target, propKey, receiver) {
            const originalMethod = target[propKey as keyof typeof target];

            if (typeof originalMethod === "function") {
                return async function (...args: any[]) {
                    await initialized;
                    return (originalMethod as any).apply(target, args);
                };
            } else {
                return originalMethod;
            }
        },
    });
}

/**
 * We need to call our internal API with system permissions in some cases.
 * As we don't have other ways to represent that (e.g. ServiceAccounts), we use this magic constant to designated it.
 */
export const SYSTEM_USER = "SYSTEM_USER";

export class Authorizer {
    constructor(private authorizer: SpiceDBAuthorizer) {}

    async hasPermissionOnInstallation(userId: string, permission: InstallationPermission): Promise<boolean> {
        if (userId === SYSTEM_USER) {
            return true;
        }

        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: object("installation", InstallationID),
            consistency,
        });

        return this.authorizer.check(req, { userId });
    }

    async checkPermissionOnInstallation(userId: string, permission: InstallationPermission): Promise<void> {
        if (await this.hasPermissionOnInstallation(userId, permission)) {
            return;
        }
        throw new ApplicationError(
            ErrorCodes.PERMISSION_DENIED,
            `User ${userId} does not have permission '${permission}' on the installation.`,
        );
    }

    async hasPermissionOnOrganization(
        userId: string,
        permission: OrganizationPermission,
        orgId: string,
    ): Promise<boolean> {
        if (userId === SYSTEM_USER) {
            return true;
        }

        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: object("organization", orgId),
            consistency,
        });

        return this.authorizer.check(req, { userId });
    }

    async checkPermissionOnOrganization(userId: string, permission: OrganizationPermission, orgId: string) {
        if (await this.hasPermissionOnOrganization(userId, permission, orgId)) {
            return;
        }
        // check if the user has read permission
        if ("read_info" === permission || !(await this.hasPermissionOnOrganization(userId, "read_info", orgId))) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Organization ${orgId} not found.`);
        }

        throw new ApplicationError(
            ErrorCodes.PERMISSION_DENIED,
            `You do not have ${permission} on organization ${orgId}`,
        );
    }

    async hasPermissionOnProject(userId: string, permission: ProjectPermission, projectId: string): Promise<boolean> {
        if (userId === SYSTEM_USER) {
            return true;
        }

        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: object("project", projectId),
            consistency,
        });

        return this.authorizer.check(req, { userId });
    }

    async checkPermissionOnProject(userId: string, permission: ProjectPermission, projectId: string) {
        if (await this.hasPermissionOnProject(userId, permission, projectId)) {
            return;
        }
        // check if the user has read permission
        if ("read_info" === permission || !(await this.hasPermissionOnProject(userId, "read_info", projectId))) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project ${projectId} not found.`);
        }

        throw new ApplicationError(
            ErrorCodes.PERMISSION_DENIED,
            `You do not have ${permission} on project ${projectId}`,
        );
    }

    async hasPermissionOnUser(userId: string, permission: UserPermission, resourceUserId: string): Promise<boolean> {
        if (userId === SYSTEM_USER) {
            return true;
        }

        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: object("user", resourceUserId),
            consistency,
        });

        return this.authorizer.check(req, { userId });
    }

    async checkPermissionOnUser(userId: string, permission: UserPermission, resourceUserId: string) {
        if (await this.hasPermissionOnUser(userId, permission, resourceUserId)) {
            return;
        }
        if ("read_info" === permission || !(await this.hasPermissionOnUser(userId, "read_info", resourceUserId))) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `User ${resourceUserId} not found.`);
        }

        throw new ApplicationError(
            ErrorCodes.PERMISSION_DENIED,
            `You do not have ${permission} on user ${resourceUserId}`,
        );
    }

    async hasPermissionOnWorkspace(
        userId: string,
        permission: WorkspacePermission,
        workspaceId: string,
    ): Promise<boolean> {
        if (userId === SYSTEM_USER) {
            return true;
        }

        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: object("workspace", workspaceId),
            consistency,
        });

        return this.authorizer.check(req, { userId });
    }

    async checkPermissionOnWorkspace(userId: string, permission: WorkspacePermission, workspaceId: string) {
        if (await this.hasPermissionOnWorkspace(userId, permission, workspaceId)) {
            return;
        }
        if ("read_info" === permission || !(await this.hasPermissionOnWorkspace(userId, "read_info", workspaceId))) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} not found.`);
        }

        throw new ApplicationError(
            ErrorCodes.PERMISSION_DENIED,
            `You do not have ${permission} on workspace ${workspaceId}`,
        );
    }

    // write operations below
    public async removeAllRelationships(userId: string, type: ResourceType, id: string) {
        if (await this.isDisabled(userId)) {
            return;
        }
        await this.authorizer.deleteRelationships(
            v1.DeleteRelationshipsRequest.create({
                relationshipFilter: {
                    resourceType: type,
                    optionalResourceId: id,
                },
            }),
        );

        // iterate over all resource types and remove by subject
        for (const resourcetype of AllResourceTypes as ResourceType[]) {
            await this.authorizer.deleteRelationships(
                v1.DeleteRelationshipsRequest.create({
                    relationshipFilter: {
                        resourceType: resourcetype,
                        optionalResourceId: "",
                        optionalRelation: "",
                        optionalSubjectFilter: {
                            subjectType: type,
                            optionalSubjectId: id,
                        },
                    },
                }),
            );
        }
    }

    private async isDisabled(userId: string): Promise<boolean> {
        return !(await isFgaAuthorizerEnabled(userId));
    }

    async addUser(userId: string, owningOrgId?: string) {
        if (await this.isDisabled(userId)) {
            return;
        }
        const oldOrgs = await this.findAll(rel.user(userId).organization.organization(""));
        const updates = [set(rel.user(userId).self.user(userId))];
        updates.push(
            ...oldOrgs
                .map((r) => r.subject?.object?.objectId)
                .filter((orgId) => !!orgId && orgId !== owningOrgId)
                .map((orgId) => remove(rel.user(userId).organization.organization(orgId!))),
        );

        if (owningOrgId) {
            updates.push(
                set(rel.user(userId).organization.organization(owningOrgId)), //
                remove(rel.user(userId).installation.installation),
                remove(rel.installation.member.user(userId)),
                remove(rel.installation.admin.user(userId)),
            );
        } else {
            updates.push(
                set(rel.user(userId).installation.installation), //
                set(rel.installation.member.user(userId)),
            );
        }

        await this.authorizer.writeRelationships(...updates);
    }

    async removeUser(userId: string) {
        if (await this.isDisabled(userId)) {
            return;
        }
        await this.removeAllRelationships(userId, "user", userId);
    }

    async addOrganizationRole(orgID: string, userID: string, role: TeamMemberRole): Promise<void> {
        if (await this.isDisabled(userID)) {
            return;
        }
        const updates = [set(rel.organization(orgID).member.user(userID))];
        if (role === "owner") {
            updates.push(set(rel.organization(orgID).owner.user(userID)));
        } else {
            updates.push(remove(rel.organization(orgID).owner.user(userID)));
        }
        await this.authorizer.writeRelationships(...updates);
    }

    async removeOrganizationRole(orgID: string, userID: string, role: TeamMemberRole): Promise<void> {
        if (await this.isDisabled(userID)) {
            return;
        }
        const updates = [remove(rel.organization(orgID).owner.user(userID))];
        if (role === "member") {
            updates.push(remove(rel.organization(orgID).member.user(userID)));
        }
        await this.authorizer.writeRelationships(...updates);
    }

    async addProjectToOrg(userId: string, orgID: string, projectID: string): Promise<void> {
        if (await this.isDisabled(userId)) {
            return;
        }
        await this.authorizer.writeRelationships(set(rel.project(projectID).org.organization(orgID)));
    }

    async setProjectVisibility(
        userId: string,
        projectID: string,
        organizationId: string,
        visibility: Project.Visibility,
    ) {
        if (await this.isDisabled(userId)) {
            return;
        }
        const updates = [];
        switch (visibility) {
            case "private":
                updates.push(remove(rel.project(projectID).viewer.organization_member(organizationId)));
                updates.push(remove(rel.project(projectID).viewer.anyUser));
                break;
            case "org-public":
                updates.push(set(rel.project(projectID).viewer.organization_member(organizationId)));
                updates.push(remove(rel.project(projectID).viewer.anyUser));
                break;
            case "public":
                updates.push(remove(rel.project(projectID).viewer.organization_member(organizationId)));
                updates.push(set(rel.project(projectID).viewer.anyUser));
                break;
        }
        await this.authorizer.writeRelationships(...updates);
    }

    async removeProjectFromOrg(userId: string, orgID: string, projectID: string): Promise<void> {
        if (await this.isDisabled(userId)) {
            return;
        }
        await this.authorizer.writeRelationships(
            remove(rel.project(projectID).org.organization(orgID)), //
            remove(rel.project(projectID).viewer.anyUser),
            remove(rel.project(projectID).viewer.organization_member(orgID)),
        );
    }

    async addOrganization(
        userId: string,
        orgId: string,
        members: { userId: string; role: TeamMemberRole }[],
        projectIds: string[],
    ): Promise<void> {
        if (await this.isDisabled(userId)) {
            return;
        }
        await this.addOrganizationMembers(orgId, members);

        await this.addOrganizationProjects(userId, orgId, projectIds);

        await this.authorizer.writeRelationships(
            set(rel.organization(orgId).installation.installation), //
            set(rel.organization(orgId).snapshoter.organization_member(orgId)), //TODO allow orgs to opt-out of snapshotting
        );
    }

    private async addOrganizationProjects(userId: string, orgID: string, projectIds: string[]): Promise<void> {
        const existing = await this.findAll(rel.project("").org.organization(orgID));
        const toBeRemoved = asSet(existing.map((r) => r.resource?.objectId));
        for (const projectId of projectIds) {
            await this.addProjectToOrg(userId, orgID, projectId);
            await this.setProjectVisibility(userId, projectId, orgID, "org-public");
            toBeRemoved.delete(projectId);
        }
        for (const projectId of toBeRemoved) {
            await this.removeProjectFromOrg(userId, orgID, projectId);
        }
    }

    private async addOrganizationMembers(
        orgID: string,
        members: { userId: string; role: TeamMemberRole }[],
    ): Promise<void> {
        const existing = await this.findAll(rel.organization(orgID).member.user(""));
        const toBeRemoved = asSet(existing.map((r) => r.subject?.object?.objectId));
        for (const member of members) {
            await this.addOrganizationRole(orgID, member.userId, member.role);
            toBeRemoved.delete(member.userId);
        }
        for (const userId of toBeRemoved) {
            await this.removeOrganizationRole(orgID, userId, "member");
        }
    }

    async addInstallationAdminRole(userId: string) {
        if (await this.isDisabled(userId)) {
            return;
        }
        await this.authorizer.writeRelationships(
            set(rel.installation.admin.user(userId)), //
        );
    }

    async removeInstallationAdminRole(userId: string) {
        if (await this.isDisabled(userId)) {
            return;
        }
        await this.authorizer.writeRelationships(
            remove(rel.installation.admin.user(userId)), //
        );
    }

    async addWorkspaceToOrg(orgID: string, userID: string, workspaceID: string, shared: boolean): Promise<void> {
        if (await this.isDisabled(userID)) {
            return;
        }
        return this.bulkAddWorkspaceToOrg([{ orgID, userID, workspaceID, shared }]);
    }

    async bulkAddWorkspaceToOrg(
        ids: { orgID: string; userID: string; workspaceID: string; shared: boolean }[],
    ): Promise<void> {
        const rels: v1.RelationshipUpdate[] = [];
        for (const { orgID, userID, workspaceID, shared } of ids) {
            this.internalAddWorkspaceToOrg(orgID, userID, workspaceID, shared, (u) => rels.push(u));
        }
        await this.authorizer.writeRelationships(...rels);
    }

    private internalAddWorkspaceToOrg(
        orgID: string,
        userID: string,
        workspaceID: string,
        shared: boolean,
        acceptor: (update: v1.RelationshipUpdate) => void,
    ): void {
        acceptor(set(rel.workspace(workspaceID).org.organization(orgID)));
        acceptor(set(rel.workspace(workspaceID).owner.user(userID)));
        if (shared) {
            acceptor(set(rel.workspace(workspaceID).shared.anyUser));
        }
    }

    async removeWorkspaceFromOrg(orgID: string, userID: string, workspaceID: string): Promise<void> {
        if (await this.isDisabled(userID)) {
            return;
        }
        await this.authorizer.writeRelationships(
            remove(rel.workspace(workspaceID).org.organization(orgID)),
            remove(rel.workspace(workspaceID).owner.user(userID)),
            remove(rel.workspace(workspaceID).shared.anyUser),
        );
    }

    async setWorkspaceIsShared(userID: string, workspaceID: string, shared: boolean): Promise<void> {
        if (await this.isDisabled(userID)) {
            return;
        }
        const op = shared ? set : remove;
        await this.authorizer.writeRelationships(op(rel.workspace(workspaceID).shared.anyUser));
    }

    public async find(relation: v1.Relationship): Promise<v1.Relationship | undefined> {
        const relationships = await this.authorizer.readRelationships({
            consistency: v1.Consistency.create({
                requirement: {
                    oneofKind: "fullyConsistent",
                    fullyConsistent: true,
                },
            }),
            relationshipFilter: {
                resourceType: relation.resource?.objectType || "",
                optionalResourceId: relation.resource?.objectId || "",
                optionalRelation: relation.relation,
                optionalSubjectFilter: relation.subject?.object && {
                    subjectType: relation.subject.object.objectType,
                    optionalSubjectId: relation.subject.object.objectId,
                },
            },
        });
        if (relationships.length === 0) {
            return undefined;
        }
        return relationships[0].relationship;
    }

    async findAll(relation: v1.Relationship): Promise<v1.Relationship[]> {
        const relationships = await this.authorizer.readRelationships({
            consistency: v1.Consistency.create({
                requirement: {
                    oneofKind: "fullyConsistent",
                    fullyConsistent: true,
                },
            }),
            relationshipFilter: {
                resourceType: relation.resource?.objectType || "",
                optionalResourceId: relation.resource?.objectId || "",
                optionalRelation: relation.relation,
                optionalSubjectFilter: relation.subject?.object && {
                    subjectType: relation.subject.object.objectType,
                    optionalSubjectId: relation.subject.object.objectId,
                },
            },
        });
        return relationships.map((r) => r.relationship!);
    }
}

// TODO(gpl) remove after FGA rollout
export async function isFgaAuthorizerEnabled(userId: string): Promise<boolean> {
    return getExperimentsClientForBackend().getValueAsync("centralizedPermissions", false, {
        user: {
            id: userId,
        },
    });
}

function set(rs: v1.Relationship): v1.RelationshipUpdate {
    return v1.RelationshipUpdate.create({
        operation: v1.RelationshipUpdate_Operation.TOUCH,
        relationship: rs,
    });
}

function remove(rs: v1.Relationship): v1.RelationshipUpdate {
    return v1.RelationshipUpdate.create({
        operation: v1.RelationshipUpdate_Operation.DELETE,
        relationship: rs,
    });
}

function object(type: ResourceType, id?: string): v1.ObjectReference {
    return v1.ObjectReference.create({
        objectId: id,
        objectType: type,
    });
}

function subject(type: ResourceType, id?: string, relation?: Relation | Permission): v1.SubjectReference {
    return v1.SubjectReference.create({
        object: object(type, id),
        optionalRelation: relation,
    });
}

const consistency = v1.Consistency.create({
    requirement: {
        oneofKind: "fullyConsistent",
        fullyConsistent: true,
    },
});

function asSet<T>(array: (T | undefined)[]): Set<T> {
    const result = new Set<T>();
    for (const r of array) {
        if (r) {
            result.add(r);
        }
    }
    return result;
}
