/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";

import { Organization, Project, TeamMemberInfo, TeamMemberRole, User } from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import {
    InstallationID,
    InstallationRelation,
    OrganizationPermission,
    OrganizationRelation,
    Permission,
    ProjectPermission,
    ProjectRelation,
    Relation,
    ResourceType,
    UserPermission,
    UserRelation,
} from "./definitions";
import { SpiceDBAuthorizer } from "./spicedb-authorizer";
import { BUILTIN_INSTLLATION_ADMIN_USER_ID } from "@gitpod/gitpod-db/lib";

export function createInitializingAuthorizer(spiceDbAuthorizer: SpiceDBAuthorizer): Authorizer {
    const target = new Authorizer(spiceDbAuthorizer);
    const initialized = target.addInstallationAdminRole(BUILTIN_INSTLLATION_ADMIN_USER_ID);
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

export const installation = {
    type: "installation",
    id: InstallationID,
};

export type Resource = typeof installation | User | Organization | Project;
export namespace Resource {
    export function getType(res: Resource): ResourceType {
        return (res as any).type === "installation"
            ? "installation"
            : User.is(res)
            ? "user"
            : Project.is(res)
            ? "project"
            : "organization";
    }
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
        const updates = [
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.TOUCH,
                relationship: relationship(objectRef("user", userId), "self", subject("user", userId)),
            }),
            v1.RelationshipUpdate.create({
                operation: v1.RelationshipUpdate_Operation.TOUCH,
                relationship: relationship(
                    objectRef("user", userId),
                    "container",
                    owningOrgId ? subject("organization", owningOrgId) : subject("installation", InstallationID),
                ),
            }),
        ];
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates,
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

    async addInstallationAdminRole(userID: string) {
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

    async removeInstallationAdminRole(userID: string) {
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

    public async readRelationships(
        inst: typeof installation,
        relation: InstallationRelation,
        target: Resource,
    ): Promise<Relationship[]>;
    public async readRelationships(user: User, relation: UserRelation, target: Resource): Promise<Relationship[]>;
    public async readRelationships(
        org: Organization,
        relation: OrganizationRelation,
        target: Resource,
    ): Promise<Relationship[]>;
    public async readRelationships(
        project: Project,
        relation: ProjectRelation,
        target: Resource,
    ): Promise<Relationship[]>;
    public async readRelationships(subject: Resource, relation?: Relation, object?: Resource): Promise<Relationship[]>;
    public async readRelationships(subject: Resource, relation?: Relation, object?: Resource): Promise<Relationship[]> {
        const relationShips = await this.authorizer.readRelationships({
            consistency: v1.Consistency.create({
                requirement: {
                    oneofKind: "fullyConsistent",
                    fullyConsistent: true,
                },
            }),
            relationshipFilter: {
                resourceType: Resource.getType(subject),
                optionalResourceId: subject.id,
                optionalRelation: relation || "",
                optionalSubjectFilter: object && {
                    subjectType: Resource.getType(object),
                    optionalSubjectId: object?.id,
                },
            },
        });
        return relationShips
            .map((rel) => {
                const subject = rel.relationship?.subject?.object;
                const object = rel.relationship?.resource;
                const relation = rel.relationship?.relation;
                if (!subject || !object || !relation) {
                    throw new Error("Invalid relationship");
                }
                return new Relationship(
                    object.objectType as ResourceType,
                    object.objectId!,
                    relation as Relation,
                    subject.objectType as ResourceType,
                    subject.objectId!,
                );
            })
            .sort((a, b) => {
                return a.toString().localeCompare(b.toString());
            });
    }
}

export class Relationship {
    constructor(
        public readonly subjectType: ResourceType,
        public readonly subjectID: string,
        public readonly relation: Relation,
        public readonly objectType: ResourceType,
        public readonly objectID: string,
    ) {}

    public toString(): string {
        return `${this.subjectType}:${this.subjectID}#${this.relation}@${this.objectType}:${this.objectID}`;
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
