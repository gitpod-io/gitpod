/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { TeamMemberRole } from "@gitpod/gitpod-protocol";
import { inject, injectable } from "inversify";
import { objectRef, relationship, subject } from "./definitions";
import { SpiceDBAuthorizer } from "./spicedb-authorizer";

@injectable()
export class AuthRelationships {
    constructor(@inject(SpiceDBAuthorizer) private readonly authorizer: SpiceDBAuthorizer) {}

    async organizationRole(orgID: string, userID: string, role: TeamMemberRole): Promise<void> {
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

    async deleteOwnerRole(orgID: string, userID: string): Promise<void> {
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
