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
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Subject, SubjectId } from "../auth/subject-id";
import { ctxTrySubjectId } from "../util/request-context";
import { reportAuthorizerSubjectId } from "../prometheus-metrics";

export function createInitializingAuthorizer(spiceDbAuthorizer: SpiceDBAuthorizer): Authorizer {
    const target = new Authorizer(spiceDbAuthorizer);
    const initialized = (async () => {
        await target.addInstallationAdminRole(BUILTIN_INSTLLATION_ADMIN_USER_ID);
        await target.addUser(BUILTIN_INSTLLATION_ADMIN_USER_ID);
    })().catch((err) => log.error("Failed to initialize authorizer", err));
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
export const SYSTEM_USER_ID = "SYSTEM_USER";
export const SYSTEM_USER = SubjectId.fromUserId(SYSTEM_USER_ID);
export function isSystemUser(subjectId: SubjectId): boolean {
    return subjectId.equals(SYSTEM_USER);
}

export class Authorizer {
    constructor(private authorizer: SpiceDBAuthorizer) {}

    async hasPermissionOnInstallation(passed: Subject, permission: InstallationPermission): Promise<boolean> {
        const subjectId = await getSubjectFromCtx(passed);
        if (isSystemUser(subjectId)) {
            return true;
        }

        const req = v1.CheckPermissionRequest.create({
            subject: sub(subjectId),
            permission,
            resource: object("installation", InstallationID),
            consistency,
        });

        return await this.authorizer.check(req, { userId: getUserId(subjectId) });
    }

    async checkPermissionOnInstallation(passed: Subject, permission: InstallationPermission): Promise<void> {
        const subjectId = await getSubjectFromCtx(passed);
        if (await this.hasPermissionOnInstallation(subjectId, permission)) {
            return;
        }
        throw new ApplicationError(
            ErrorCodes.PERMISSION_DENIED,
            `Subject ${subjectId.toString()} does not have permission '${permission}' on the installation.`,
        );
    }

    async hasPermissionOnOrganization(
        passed: Subject,
        permission: OrganizationPermission,
        orgId: string,
    ): Promise<boolean> {
        const subjectId = await getSubjectFromCtx(passed);
        if (isSystemUser(subjectId)) {
            return true;
        }

        const req = v1.CheckPermissionRequest.create({
            subject: sub(subjectId),
            permission,
            resource: object("organization", orgId),
            consistency,
        });

        return await this.authorizer.check(req, { userId: getUserId(subjectId) });
    }

    async checkPermissionOnOrganization(passed: Subject, permission: OrganizationPermission, orgId: string) {
        const subjectId = await getSubjectFromCtx(passed);
        if (await this.hasPermissionOnOrganization(subjectId, permission, orgId)) {
            return;
        }
        // check if the user has read permission
        if ("read_info" === permission || !(await this.hasPermissionOnOrganization(subjectId, "read_info", orgId))) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Organization ${orgId} not found.`);
        }

        throw new ApplicationError(
            ErrorCodes.PERMISSION_DENIED,
            `You do not have ${permission} on organization ${orgId}`,
        );
    }

    async hasPermissionOnProject(passed: Subject, permission: ProjectPermission, projectId: string): Promise<boolean> {
        const subjectId = await getSubjectFromCtx(passed);
        if (isSystemUser(subjectId)) {
            return true;
        }

        const req = v1.CheckPermissionRequest.create({
            subject: sub(subjectId),
            permission,
            resource: object("project", projectId),
            consistency,
        });

        return await this.authorizer.check(req, { userId: getUserId(subjectId) });
    }

    async checkPermissionOnProject(passed: Subject, permission: ProjectPermission, projectId: string) {
        const subjectId = await getSubjectFromCtx(passed);
        if (await this.hasPermissionOnProject(subjectId, permission, projectId)) {
            return;
        }
        // check if the user has read permission
        if ("read_info" === permission || !(await this.hasPermissionOnProject(subjectId, "read_info", projectId))) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Project ${projectId} not found.`);
        }

        throw new ApplicationError(
            ErrorCodes.PERMISSION_DENIED,
            `You do not have ${permission} on project ${projectId}`,
        );
    }

    async hasPermissionOnUser(passed: Subject, permission: UserPermission, resourceUserId: string): Promise<boolean> {
        const subjectId = await getSubjectFromCtx(passed);
        if (isSystemUser(subjectId)) {
            return true;
        }

        const req = v1.CheckPermissionRequest.create({
            subject: sub(subjectId),
            permission,
            resource: object("user", resourceUserId),
            consistency,
        });

        return await this.authorizer.check(req, { userId: getUserId(subjectId) });
    }

    async checkPermissionOnUser(passed: Subject, permission: UserPermission, resourceUserId: string) {
        const subjectId = await getSubjectFromCtx(passed);
        if (await this.hasPermissionOnUser(subjectId, permission, resourceUserId)) {
            return;
        }
        if ("read_info" === permission || !(await this.hasPermissionOnUser(subjectId, "read_info", resourceUserId))) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `User ${resourceUserId} not found.`);
        }

        throw new ApplicationError(
            ErrorCodes.PERMISSION_DENIED,
            `You do not have ${permission} on user ${resourceUserId}`,
        );
    }

    async hasPermissionOnWorkspace(
        passed: Subject,
        permission: WorkspacePermission,
        workspaceId: string,
    ): Promise<boolean> {
        const subjectId = await getSubjectFromCtx(passed);
        if (isSystemUser(subjectId)) {
            return true;
        }

        const req = v1.CheckPermissionRequest.create({
            subject: sub(subjectId),
            permission,
            resource: object("workspace", workspaceId),
            consistency,
        });

        return await this.authorizer.check(req, { userId: getUserId(subjectId) });
    }

    async checkPermissionOnWorkspace(passed: Subject, permission: WorkspacePermission, workspaceId: string) {
        const subjectId = await getSubjectFromCtx(passed);
        if (await this.hasPermissionOnWorkspace(subjectId, permission, workspaceId)) {
            return;
        }
        if ("read_info" === permission || !(await this.hasPermissionOnWorkspace(subjectId, "read_info", workspaceId))) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, `Workspace ${workspaceId} not found.`);
        }

        throw new ApplicationError(
            ErrorCodes.PERMISSION_DENIED,
            `You do not have ${permission} on workspace ${workspaceId}`,
        );
    }

    // write operations below
    public async removeAllRelationships(userId: string, type: ResourceType, id: string) {
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

    async addUser(userId: string, owningOrgId?: string) {
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
        await this.removeAllRelationships(userId, "user", userId);
    }

    async addOrganizationRole(orgID: string, userID: string, role: TeamMemberRole): Promise<void> {
        const updates = [];
        if (role === "owner") {
            updates.push(
                set(rel.organization(orgID).owner.user(userID)),
                // TODO: owner has all permission member's permission should define in schema
                // we should remove member but since old code was not, keep it to avoid breaking
                set(rel.organization(orgID).member.user(userID)),
                remove(rel.organization(orgID).collaborator.user(userID)),
            );
        } else if (role === "member") {
            updates.push(
                remove(rel.organization(orgID).owner.user(userID)),
                set(rel.organization(orgID).member.user(userID)),
                remove(rel.organization(orgID).collaborator.user(userID)),
            );
        } else if (role === "collaborator") {
            updates.push(
                remove(rel.organization(orgID).owner.user(userID)),
                remove(rel.organization(orgID).member.user(userID)),
                set(rel.organization(orgID).collaborator.user(userID)),
            );
        }
        await this.authorizer.writeRelationships(...updates);
    }

    async removeOrganizationRole(orgID: string, userID: string, role: TeamMemberRole): Promise<void> {
        const updates = [];
        if (role === "owner") {
            updates.push(remove(rel.organization(orgID).owner.user(userID)));
        } else if (role === "member") {
            updates.push(
                remove(rel.organization(orgID).owner.user(userID)),
                remove(rel.organization(orgID).member.user(userID)),
            );
        } else if (role === "collaborator") {
            updates.push(
                remove(rel.organization(orgID).owner.user(userID)),
                remove(rel.organization(orgID).member.user(userID)),
                remove(rel.organization(orgID).collaborator.user(userID)),
            );
        }
        await this.authorizer.writeRelationships(...updates);
    }

    async addProjectToOrg(userId: string, orgID: string, projectID: string): Promise<void> {
        await this.authorizer.writeRelationships(set(rel.project(projectID).org.organization(orgID)));
    }

    async setProjectVisibility(
        userId: string,
        projectID: string,
        organizationId: string,
        visibility: Project.Visibility,
    ) {
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
        await this.authorizer.writeRelationships(
            set(rel.installation.admin.user(userId)), //
        );
    }

    async removeInstallationAdminRole(userId: string) {
        await this.authorizer.writeRelationships(
            remove(rel.installation.admin.user(userId)), //
        );
    }

    async addWorkspaceToOrg(orgID: string, userID: string, workspaceID: string, shared: boolean): Promise<void> {
        const rels: v1.RelationshipUpdate[] = [];
        rels.push(set(rel.workspace(workspaceID).org.organization(orgID)));
        rels.push(set(rel.workspace(workspaceID).owner.user(userID)));
        if (shared) {
            rels.push(set(rel.workspace(workspaceID).shared.anyUser));
        }
        await this.authorizer.writeRelationships(...rels);
    }

    async removeWorkspaceFromOrg(orgID: string, userID: string, workspaceID: string): Promise<void> {
        await this.authorizer.writeRelationships(
            remove(rel.workspace(workspaceID).org.organization(orgID)),
            remove(rel.workspace(workspaceID).owner.user(userID)),
            remove(rel.workspace(workspaceID).shared.anyUser),
        );
    }

    async setWorkspaceIsShared(userID: string, workspaceID: string, shared: boolean): Promise<void> {
        if (shared) {
            await this.authorizer.writeRelationships(set(rel.workspace(workspaceID).shared.anyUser));

            // verify the relationship is there
            const rs = await this.find(rel.workspace(workspaceID).shared.anyUser);
            if (!rs) {
                log.error("Failed to set workspace as shared", { workspaceID, userID });
            } else {
                log.info("Successfully set workspace as shared", { workspaceID, userID });
            }
        } else {
            await this.authorizer.writeRelationships(remove(rel.workspace(workspaceID).shared.anyUser));
        }
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
                optionalResourceIdPrefix: "",
                optionalResourceId: relation.resource?.objectId || "",
                optionalRelation: relation.relation,
                optionalSubjectFilter: relation.subject?.object && {
                    subjectType: relation.subject.object.objectType,
                    optionalSubjectId: relation.subject.object.objectId,
                },
            },
            optionalLimit: 0,
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
                optionalResourceIdPrefix: "",
                optionalResourceId: relation.resource?.objectId || "",
                optionalRelation: relation.relation,
                optionalSubjectFilter: relation.subject?.object && {
                    subjectType: relation.subject.object.objectType,
                    optionalSubjectId: relation.subject.object.objectId,
                },
            },
            optionalLimit: 0,
        });
        return relationships.map((r) => r.relationship!);
    }
}

export async function getSubjectFromCtx(passed: Subject): Promise<SubjectId> {
    const ctxSubjectId = ctxTrySubjectId();
    const ctxUserId = ctxSubjectId?.userId();

    const passedSubjectId = !!passed ? Subject.toId(passed) : undefined;
    const passedUserId = passedSubjectId?.userId();

    // Check: Do the subjectIds match?
    function matchSubjectIds(ctxUserId: string | undefined, passedSubjectId: string | undefined) {
        if (!ctxUserId) {
            return "ctx-user-id-missing";
        }
        if (!passedSubjectId) {
            return "passed-subject-id-missing";
        }
        return ctxUserId === passedUserId ? "match" : "mismatch";
    }
    const match = matchSubjectIds(ctxUserId, passedUserId);
    reportAuthorizerSubjectId(match);
    if (match === "mismatch" || match === "ctx-user-id-missing") {
        try {
            // Get hold of the stack trace
            throw new Error("Authorizer: SubjectId mismatch");
        } catch (err) {
            log.error("Authorizer: SubjectId mismatch", err, {
                match,
                ctxUserId,
                passedUserId,
            });
        }
    }

    // Check feature flag, based on the passed subjectId
    const authViaContext = await getExperimentsClientForBackend().getValueAsync("authWithRequestContext", false, {
        user: ctxUserId
            ? {
                  id: ctxUserId,
              }
            : undefined,
    });
    if (!authViaContext) {
        if (!passedSubjectId) {
            const err = new ApplicationError(ErrorCodes.PERMISSION_DENIED, `Cannot authorize request`);
            log.error("Authorizer: Cannot authorize request: missing SubjectId", err, {
                match,
                ctxSubjectId,
                ctxUserId,
                passedUserId,
            });
            throw err;
        }
        return passedSubjectId;
    }

    if (!ctxSubjectId || match === "mismatch") {
        const err = new ApplicationError(ErrorCodes.PERMISSION_DENIED, `Cannot authorize request`);
        log.error("Authorizer: Cannot authorize request", err, { match, ctxSubjectId, ctxUserId, passedUserId });
        throw err;
    }
    return ctxSubjectId;
}

function getUserId(subjectId: SubjectId): string {
    const userId = subjectId.userId();
    if (!userId) {
        throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, `No userId available`);
    }
    return userId;
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

function sub(subject: Subject, relation?: Relation | Permission): v1.SubjectReference {
    const subjectId = Subject.toId(subject);
    return v1.SubjectReference.create({
        object: object(subjectId.kind, subjectId.value),
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
