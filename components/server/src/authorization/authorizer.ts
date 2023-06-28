/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { inject, injectable } from "inversify";

import { OrganizationPermission, Permission, Relation, ResourceType } from "./definitions";
import { SpiceDBAuthorizer } from "./spicedb-authorizer";
import { TeamMemberRole } from "@gitpod/gitpod-protocol";

@injectable()
export class Authorizer {
    constructor(
        @inject(SpiceDBAuthorizer)
        private authorizer: SpiceDBAuthorizer,
    ) {}

    async hasPermissionOnOrganization(
        userId: string,
        permission: OrganizationPermission,
        orgId: string,
    ): Promise<boolean> {
        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: objectRef("organization", orgId),
            consistency: v1.Consistency.create({
                requirement: {
                    oneofKind: "fullyConsistent",
                    fullyConsistent: true,
                },
            }),
        });

        return this.authorizer.check(req, { orgID: orgId });
    }

    // write operations below

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
                updates: [
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.TOUCH,
                        relationship: relationship(objectRef("organization", orgID), "owner", subject("user", userID)),
                    }),
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.TOUCH,
                        relationship: relationship(objectRef("organization", orgID), "member", subject("user", userID)),
                    }),
                ],
            }),
            {
                orgID,
            },
        );
    }

    async addOrganizationMemberRole(orgID: string, userID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: [
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.TOUCH,
                        relationship: relationship(objectRef("organization", orgID), "member", subject("user", userID)),
                    }),
                ],
            }),
            {
                orgID,
            },
        );
    }

    async removeOrganizationOwnerRole(orgID: string, userID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: [
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.DELETE,
                        relationship: relationship(objectRef("organization", orgID), "owner", subject("user", userID)),
                    }),
                ],
            }),
            {
                orgID,
            },
        );
    }

    async removeUserFromOrg(orgID: string, userID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: [
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.DELETE,
                        relationship: relationship(objectRef("organization", orgID), "member", subject("user", userID)),
                    }),
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.DELETE,
                        relationship: relationship(objectRef("organization", orgID), "owner", subject("user", userID)),
                    }),
                ],
            }),
            {
                orgID,
            },
        );
    }

    async addProjectToOrg(orgID: string, projectID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: [
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.TOUCH,
                        relationship: relationship(
                            objectRef("project", projectID),
                            "org",
                            subject("organization", orgID),
                        ),
                    }),
                ],
            }),
            {
                orgID,
            },
        );
    }

    async removeProjectFromOrg(orgID: string, projectID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            v1.WriteRelationshipsRequest.create({
                updates: [
                    v1.RelationshipUpdate.create({
                        operation: v1.RelationshipUpdate_Operation.DELETE,
                        relationship: relationship(
                            objectRef("project", projectID),
                            "org",
                            subject("organization", orgID),
                        ),
                    }),
                ],
            }),
            {
                orgID,
            },
        );
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
