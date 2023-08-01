/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";

import { BUILTIN_INSTLLATION_ADMIN_USER_ID } from "@gitpod/gitpod-db/lib";
import { Organization, Project, TeamMemberInfo, TeamMemberRole } from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import {
    OrganizationPermission,
    Permission,
    ProjectPermission,
    Relation,
    ResourceType,
    UserPermission,
    rel,
} from "./definitions";
import { SpiceDBAuthorizer } from "./spicedb-authorizer";

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

export class Authorizer {
    constructor(private authorizer: SpiceDBAuthorizer) {}

    async hasPermissionOnOrganization(
        userId: string,
        permission: OrganizationPermission,
        orgId: string,
    ): Promise<boolean> {
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

    async hasPermissionOnUser(userId: string, permission: UserPermission, userResourceId: string): Promise<boolean> {
        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: object("user", userResourceId),
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

    // write operations below

    public async removeAllRelationships(type: ResourceType, id: string) {
        await this.authorizer.deleteRelationships(
            v1.DeleteRelationshipsRequest.create({
                relationshipFilter: {
                    resourceType: type,
                    optionalResourceId: id,
                },
            }),
        );

        // iterate over all resource types and remove by subject
        for (const resourcetype of ["installation", "user", "organization", "project"] as ResourceType[]) {
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

    async addUser(userId: string, owningOrgId?: string) {
        await this.authorizer.writeRelationships(
            set(rel.user(userId).self.user(userId)), //
            set(
                owningOrgId
                    ? rel.user(userId).organization.organization(owningOrgId)
                    : rel.user(userId).installation.installation,
            ),
        );
    }

    async addOrganizationRole(orgID: string, userID: string, role: TeamMemberRole): Promise<void> {
        const updates = [set(rel.organization(orgID).member.user(userID))];
        if (role === "owner") {
            updates.push(set(rel.organization(orgID).owner.user(userID)));
        } else {
            updates.push(remove(rel.organization(orgID).owner.user(userID)));
        }
        await this.authorizer.writeRelationships(...updates);
    }

    async removeOrganizationRole(orgID: string, userID: string, role: TeamMemberRole): Promise<void> {
        const updates = [remove(rel.organization(orgID).owner.user(userID))];
        if (role === "member") {
            updates.push(remove(rel.organization(orgID).member.user(userID)));
        }
        await this.authorizer.writeRelationships(...updates);
    }

    async addProjectToOrg(orgID: string, projectID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            set(rel.project(projectID).org.organization(orgID)), //
        );
    }

    async removeProjectFromOrg(orgID: string, projectID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            remove(rel.project(projectID).org.organization(orgID)), //
        );
    }

    async addOrganization(org: Organization, members: TeamMemberInfo[], projects: Project[]): Promise<void> {
        for (const member of members) {
            await this.addOrganizationRole(org.id, member.userId, member.role);
        }

        for (const project of projects) {
            await this.addProjectToOrg(org.id, project.id);
        }

        await this.authorizer.writeRelationships(
            set(rel.organization(org.id).installation.installation), //
        );
    }

    async addInstallationMemberRole(userID: string) {
        await this.authorizer.writeRelationships(
            set(rel.installation.member.user(userID)), //
        );
    }

    async removeInstallationMemberRole(userID: string) {
        await this.authorizer.writeRelationships(
            remove(rel.installation.member.user(userID)), //
        );
    }

    async addInstallationAdminRole(userID: string) {
        await this.authorizer.writeRelationships(
            set(rel.installation.admin.user(userID)), //
        );
    }

    async removeInstallationAdminRole(userID: string) {
        await this.authorizer.writeRelationships(
            remove(rel.installation.admin.user(userID)), //
        );
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

function object(type: ResourceType, id: string): v1.ObjectReference {
    return v1.ObjectReference.create({
        objectId: id,
        objectType: type,
    });
}

function subject(type: ResourceType, id: string, relation?: Relation | Permission): v1.SubjectReference {
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
