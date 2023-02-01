/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { inject, injectable } from "inversify";
import { ResponseError } from "vscode-ws-jsonrpc";
import { SpiceDBClient } from "./spicedb";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";

const organizationRoles: OrganizationRelation[] = ["member", "owner"];

@injectable()
export class Permissions {
    @inject(SpiceDBClient)
    protected readonly client: SpiceDBClient;

    async grantOrganizationRole(
        userID: string,
        role: OrganizationRelation,
        organizationID: string,
    ): Promise<v1.WriteRelationshipsResponse> {
        // Collect the roles which we're not granting in this request
        const toRemove = organizationRoles.filter((r) => r !== role);

        const req = v1.WriteRelationshipsRequest.create({
            updates: [
                v1.RelationshipUpdate.create({
                    relationship: relationship(obj("organization", organizationID), role, userSubject(userID)),
                    operation: v1.RelationshipUpdate_Operation.TOUCH, // either we add it, or we do not error if it exists.
                }),
                // also remove any other roles
                ...toRemove.map((r) =>
                    v1.RelationshipUpdate.create({
                        relationship: relationship(obj("organization", organizationID), r, userSubject(userID)),
                        operation: v1.RelationshipUpdate_Operation.DELETE, // delete any other ones, if they do not exist, this operation doesn ot fail
                    }),
                ),
            ],
        });

        const response = await this.client.writeRelationships(req);
        log.info("Completed spicedb write.", {
            updates: req.updates,
            response,
        });

        return response;
    }

    async removeOrganizationMember(userID: string, organizationID: string): Promise<v1.WriteRelationshipsResponse> {
        const req = v1.WriteRelationshipsRequest.create({
            updates: [
                ...organizationRoles.map((role) =>
                    v1.RelationshipUpdate.create({
                        relationship: relationship(obj("organization", organizationID), role, userSubject(userID)),
                        operation: v1.RelationshipUpdate_Operation.DELETE, // either we add it, or we do not error if it exists.
                    }),
                ),
            ],
        });

        const response = await this.client.writeRelationships(req);
        log.info("Completed spicedb write.", {
            updates: req.updates,
            response,
        });

        return response;
    }

    async listAllowedOrganizations(userID: string): Promise<Set<string>> {
        const req = v1.LookupResourcesRequest.create({
            subject: userSubject(userID),
            permission: "organization_read",
            resourceObjectType: "organization",
        });
        const response = await this.client.lookupResources(req);

        const ids = new Set(response.map((r) => r.resourceObjectId));
        log.info("Completed spicedb resource lookup.", {
            request: req,
            response,
        });

        return ids;
    }

    async allowedToWriteOrganizationMembers(userID: string, organizationID: string): Promise<void> {
        const resource = obj("organization", organizationID);
        const relation = "organization_members_write";
        const subject = userSubject(userID);

        return this.check(resource, relation, subject);
    }

    async allowedToReadOrganizationMembers(userID: string, organizationID: string): Promise<void> {
        const resource = obj("organization", organizationID);
        const relation = "organization_members_read";
        const subject = userSubject(userID);

        return this.check(resource, relation, subject);
    }

    async allowedToReadOrganization(userID: string, organizationID: string): Promise<void> {
        const resource = obj("organization", organizationID);
        const relation = "organization_read";
        const subject = userSubject(userID);

        return this.check(resource, relation, subject);
    }

    async allowedToWriteOrganization(userID: string, organizationID: string): Promise<void> {
        const resource = obj("organization", organizationID);
        const relation = "organization_write";
        const subject = userSubject(userID);

        return this.check(resource, relation, subject);
    }

    async createOrganization(userID: string): Promise<void> {
        // Any user is permitted to create an organization.
        return new Promise((resolve) => resolve());
    }

    private async check(resource: v1.ObjectReference, relation: Relation, subject: v1.SubjectReference): Promise<void> {
        const req = check(resource, relation, subject);

        const response = await this.client.checkPermission(req);
        log.info("Completed spicedb permission check.", {
            resource,
            relation,
            subject,
            response,
        });
        if (response.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION) {
            return;
        }

        throw newUnathorizedError(resource, relation, subject);
    }
}

type ObjectType = "organization" | "user";

type OrganizationRelation = "owner" | "member";

type OrganizationPermission =
    | "organization_read"
    | "organization_write"
    | "organization_members_read"
    | "organization_members_write";

type Relation = OrganizationRelation | OrganizationPermission;

function check(resource: v1.ObjectReference, relation: Relation, subject: v1.SubjectReference) {
    return v1.CheckPermissionRequest.create({
        subject: subject,
        permission: relation,
        resource: resource,
    });
}

function relationship(resource: v1.ObjectReference, relation: Relation, subject: v1.SubjectReference) {
    return v1.Relationship.create({
        resource: resource,
        relation: relation,
        subject: subject,
    });
}

function obj(type: ObjectType, id: string): v1.ObjectReference {
    return v1.ObjectReference.create({
        objectType: type,
        objectId: id,
    });
}

function userSubject(id: string): v1.SubjectReference {
    return v1.SubjectReference.create({
        object: obj("user", id),
    });
}

function newUnathorizedError(resource: v1.ObjectReference, relation: Relation, subject: v1.SubjectReference) {
    return new ResponseError(
        ErrorCodes.PERMISSION_DENIED,
        `Subject (${objString(subject.object)}) is not permitted to perform ${relation} on resource ${objString(
            resource,
        )}.`,
    );
}

function objString(obj?: v1.ObjectReference): string {
    return `${obj?.objectType}:${obj?.objectId}`;
}
