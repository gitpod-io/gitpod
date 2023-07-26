/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { inject, injectable } from "inversify";

import {
    InstallationID,
    OrganizationPermission,
    Permission,
    ProjectPermission,
    Relation,
    ResourceType,
    UserPermission,
} from "./definitions";
import { SpiceDBAuthorizer } from "./spicedb-authorizer";
import { Organization, TeamMemberInfo, Project, TeamMemberRole } from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID } from "@gitpod/gitpod-db/lib";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

@injectable()
export class Authorizer {
    constructor(
        @inject(SpiceDBAuthorizer)
        private authorizer: SpiceDBAuthorizer,
    ) {
        this.initialize().catch((err) => log.error("Failed to add installation admin", err));
    }

    private async initialize(): Promise<void> {
        await this.addAdminRole(BUILTIN_INSTLLATION_ADMIN_USER_ID);
    }

    async hasPermissionOnOrganization(
        userId: string,
        permission: OrganizationPermission,
        orgId: string,
    ): Promise<boolean> {
        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: objectRef("organization", orgId),
            consistency,
        });

        return this.authorizer.check(req, { userId });
    }

    async checkOrgPermissionAndThrow(userId: string, permission: OrganizationPermission, orgId: string) {
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
            resource: objectRef("project", projectId),
            consistency,
        });

        return this.authorizer.check(req, { userId });
    }

    async checkProjectPermissionAndThrow(userId: string, permission: ProjectPermission, projectId: string) {
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
            resource: objectRef("user", userResourceId),
            consistency,
        });

        return this.authorizer.check(req, { userId });
    }

    async checkUserPermissionAndThrow(userId: string, permission: UserPermission, resourceUserId: string) {
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

    async addUser(userId: string) {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: [
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.TOUCH,
                        relationship: relationship(objectRef("user", userId), "self", subject("user", userId)),
                    }),
                ],
            }),
        );
    }

    async addOrganizationRole(orgID: string, userID: string, role: TeamMemberRole): Promise<void> {
        if (role === "owner") {
            await this.addOrganizationOwnerRole(orgID, userID);
        } else {
            await this.addOrganizationMemberRole(orgID, userID);
        }
    }

    async addOrganizationOwnerRole(orgID: string, userID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: this.addOrganizationOwnerRoleUpdates(orgID, userID),
            }),
        );
    }

    async addOrganizationMemberRole(orgID: string, userID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: this.addOrganizationMemberRoleUpdates(orgID, userID),
            }),
        );
    }

    async removeOrganizationOwnerRole(orgID: string, userID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: this.removeOrganizationOwnerRoleUpdates(orgID, userID),
            }),
        );
    }

    async removeUserFromOrg(orgID: string, userID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: [
                    ...this.removeOrganizationMemberRoleUpdates(orgID, userID),
                    ...this.removeOrganizationOwnerRoleUpdates(orgID, userID),
                ],
            }),
        );
    }

    async addProjectToOrg(orgID: string, projectID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: this.addProjectToOrgUpdates(orgID, projectID),
            }),
        );
    }

    async removeProjectFromOrg(orgID: string, projectID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: this.removeProjectFromOrgUpdates(orgID, projectID),
            }),
        );
    }

    async deleteOrganization(orgID: string): Promise<void> {
        await this.authorizer.deleteRelationships(
            v1.DeleteRelationshipsRequest.create({
                relationshipFilter: v1.RelationshipFilter.create({
                    resourceType: "organization",
                    optionalResourceId: orgID,
                }),
            }),
        );
    }

    async addOrganization(org: Organization, members: TeamMemberInfo[], projects: Project[]): Promise<void> {
        const updates: v1.RelationshipUpdate[] = [];

        // every org belongs to the installation
        updates.push(
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.TOUCH,
                relationship: relationship(
                    objectRef("organization", org.id),
                    "installation",
                    subject("installation", InstallationID),
                ),
            }),
        );

        for (const member of members) {
            updates.push(...this.addOrganizationRoleUpdates(org.id, member.userId, member.role));
        }

        for (const project of projects) {
            updates.push(...this.addProjectToOrgUpdates(org.id, project.id));
        }

        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: updates,
            }),
        );
    }

    async addInstallationMemberRole(userID: string) {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: [
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.TOUCH,
                        relationship: relationship(
                            objectRef("installation", InstallationID),
                            "member",
                            subject("user", userID),
                        ),
                    }),
                ],
            }),
        );
    }

    async removeInstallationMemberRole(userID: string) {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: [
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.DELETE,
                        relationship: relationship(
                            objectRef("installation", InstallationID),
                            "member",
                            subject("user", userID),
                        ),
                    }),
                ],
            }),
        );
    }

    async addAdminRole(userID: string) {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: [
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.TOUCH,
                        relationship: relationship(
                            objectRef("installation", InstallationID),
                            "admin",
                            subject("user", userID),
                        ),
                    }),
                ],
            }),
        );
    }

    async removeAdminRole(userID: string) {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: [
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.DELETE,
                        relationship: relationship(
                            objectRef("installation", InstallationID),
                            "admin",
                            subject("user", userID),
                        ),
                    }),
                ],
            }),
        );
    }

    private addOrganizationRoleUpdates(orgID: string, userID: string, role: TeamMemberRole): v1.RelationshipUpdate[] {
        if (role === "owner") {
            return this.addOrganizationOwnerRoleUpdates(orgID, userID);
        }
        return this.addOrganizationMemberRoleUpdates(orgID, userID);
    }

    private addOrganizationMemberRoleUpdates(orgID: string, userID: string): v1.RelationshipUpdate[] {
        return [
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.TOUCH,
                relationship: relationship(objectRef("organization", orgID), "member", subject("user", userID)),
            }),
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.TOUCH,
                relationship: relationship(objectRef("user", userID), "container", subject("organization", orgID)),
            }),
        ];
    }

    private addOrganizationOwnerRoleUpdates(orgID: string, userID: string): v1.RelationshipUpdate[] {
        return [
            ...this.addOrganizationMemberRoleUpdates(orgID, userID),
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.TOUCH,
                relationship: relationship(objectRef("organization", orgID), "owner", subject("user", userID)),
            }),
        ];
    }

    private removeOrganizationOwnerRoleUpdates(orgID: string, userID: string): v1.RelationshipUpdate[] {
        return [
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.DELETE,
                relationship: relationship(objectRef("organization", orgID), "owner", subject("user", userID)),
            }),
        ];
    }

    private removeOrganizationMemberRoleUpdates(orgID: string, userID: string): v1.RelationshipUpdate[] {
        return [
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.DELETE,
                relationship: relationship(objectRef("organization", orgID), "member", subject("user", userID)),
            }),
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.DELETE,
                relationship: relationship(objectRef("user", userID), "container", subject("organization", orgID)),
            }),
        ];
    }

    private removeProjectFromOrgUpdates(orgID: string, projectID: string): v1.RelationshipUpdate[] {
        return [
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.DELETE,
                relationship: relationship(objectRef("project", projectID), "org", subject("organization", orgID)),
            }),
        ];
    }

    private addProjectToOrgUpdates(orgID: string, projectID: string): v1.RelationshipUpdate[] {
        return [
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.TOUCH,
                relationship: relationship(objectRef("project", projectID), "org", subject("organization", orgID)),
            }),
        ];
    }
}

function objectRef(type: ResourceType, id: string): v1.ObjectReference {
    return v1.ObjectReference.create({
        objectId: id,
        objectType: type,
    });
}

function relationship(res: v1.ObjectReference, relation: Relation, subject: v1.SubjectReference): v1.Relationship {
    return v1.Relationship.create({
        relation: relation,
        resource: res,
        subject: subject,
    });
}

function subject(type: ResourceType, id: string, relation?: Relation | Permission): v1.SubjectReference {
    return v1.SubjectReference.create({
        object: objectRef(type, id),
        optionalRelation: relation,
    });
}

const consistency = v1.Consistency.create({
    requirement: {
        oneofKind: "fullyConsistent",
        fullyConsistent: true,
    },
});
