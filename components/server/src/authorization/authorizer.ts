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
import { LogContext, log } from "@gitpod/gitpod-protocol/lib/util/logging";

export function createInitializingAuthorizer(spiceDbAuthorizer: SpiceDBAuthorizer): Authorizer {
    const target = new Authorizer(spiceDbAuthorizer, new ZedTokenCache());
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

namespace InstallationPermission {
    export function isWritePermission(permission: InstallationPermission): boolean {
        switch (permission) {
            case "configure":
            case "create_organization":
                return true;
        }
    }
}

namespace UserPermission {
    export function isWritePermission(permission: UserPermission): boolean {
        switch (permission) {
            case "admin_control":
            case "delete":
            case "make_admin":
            case "write_env_var":
            case "write_info":
            case "write_ssh":
            case "write_tokens":
                return true;
            case "read_env_var":
            case "read_info":
            case "read_ssh":
            case "read_tokens":
                return false;
        }
    }
}

namespace OrganizationPermission {
    export function isWritePermission(permission: OrganizationPermission): boolean {
        switch (permission) {
            case "installation_admin":
            case "installation_member":
            case "create_project":
            case "create_workspace":
            case "delete":
            case "invite_members":
            case "leave":
            case "write_billing":
            case "write_billing_admin":
            case "write_git_provider":
            case "write_info":
            case "write_members":
            case "write_settings":
                return true;
            case "read_billing":
            case "read_git_provider":
            case "read_info":
            case "read_members":
            case "read_settings":
                return false;
        }
    }
}

namespace ProjectPermission {
    export function isWritePermission(permission: ProjectPermission): boolean {
        switch (permission) {
            case "delete":
            case "editor":
            case "write_env_var":
            case "write_info":
            case "write_prebuild":
                return true;
            case "read_env_var":
            case "read_info":
            case "read_prebuild":
                return false;
        }
    }
}

namespace WorkspacePermission {
    export function isWritePermission(permission: WorkspacePermission): boolean {
        switch (permission) {
            case "delete":
            case "create_snapshot":
            case "admin_control":
            case "access":
            case "start":
            case "stop":
                return true;

            case "read_info":
                return false;
        }
    }
}
type AllPermissions =
    | InstallationPermission
    | UserPermission
    | OrganizationPermission
    | ProjectPermission
    | WorkspacePermission;

type ObjectId = {
    kind: ObjectKind;
    value: string;
};
type ObjectKind = keyof typeof ObjectKindNames;
const ObjectKindNames = {
    installation: "inst",
    user: "user",
    organization: "org",
    project: "proj",
    workspace: "ws",
};
const ObjectKindByShortName: ReadonlyMap<string, ObjectKind> = new Map(
    Object.keys(ObjectKindNames).map((k) => {
        return [ObjectKindNames[k as ObjectKind], k as ObjectKind];
    }),
);

namespace ObjectId {
    const SEPARATOR = "_";
    export function create(kind: ObjectKind, value: string): ObjectId {
        switch (kind) {
            case "installation":
                return { kind, value };
            case "user":
                return { kind, value };
            case "organization":
                return { kind, value };
            case "project":
                return { kind, value };
            case "workspace":
                return { kind, value };
        }
    }
    export function isObjectKind(str: string): str is ObjectKind {
        return !!ObjectKindNames[str as ObjectKind];
    }
    export function fromResource(resource: v1.ObjectReference): ObjectId {
        if (!ObjectId.isObjectKind(resource.objectType)) {
            throw new Error("Unknown object kind: " + resource.objectType);
        }
        return ObjectId.create(resource.objectType, resource.objectId);
    }
    export function toString(id: ObjectId): string {
        const prefix = ObjectKindNames[id.kind];
        return prefix + SEPARATOR + id.value;
    }
    export function tryParse(str: string): ObjectId {
        const parts = str.split(SEPARATOR);
        if (parts.length < 2) {
            throw new Error(`Unable to parse ObjectId`);
        }
        const kind = ObjectKindByShortName.get(parts[0]);
        if (!kind) {
            throw new Error(`Unable to parse ObjectId: unknown objectKind!`);
        }
        const value = parts.slice(1).join();
        return { kind, value };
    }
}

class ZedTokenCache {
    private readonly cache = new Map<string, string>();

    constructor() {}

    public async get(objectId: ObjectId): Promise<string | undefined> {
        return this.cache.get(ObjectId.toString(objectId));
    }

    public async set(objectId: ObjectId, zedToken: string) {
        this.cache.set(ObjectId.toString(objectId), zedToken);
    }
}

/**
 * We need to call our internal API with system permissions in some cases.
 * As we don't have other ways to represent that (e.g. ServiceAccounts), we use this magic constant to designated it.
 */
export const SYSTEM_USER = "SYSTEM_USER";

export class Authorizer {
    constructor(private authorizer: SpiceDBAuthorizer, private tokenCache: ZedTokenCache) {}

    async hasPermissionOnInstallation(userId: string, permission: InstallationPermission): Promise<boolean> {
        if (userId === SYSTEM_USER) {
            return true;
        }

        const objectId = ObjectId.create("installation", InstallationID);
        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: object("installation", InstallationID),
        });

        return this.check(objectId, req, { userId });
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

        const objectId = ObjectId.create("organization", orgId);
        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: object("organization", orgId),
        });

        return this.check(objectId, req, { userId });
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

        const objectId = ObjectId.create("project", projectId);
        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: object("project", projectId),
        });

        return this.check(objectId, req, { userId });
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

        const objectId = ObjectId.create("user", resourceUserId);
        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: object("user", resourceUserId),
        });

        return this.check(objectId, req, { userId });
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
        forceEnablement?: boolean, // temporary to find an issue with workspace sharing
    ): Promise<boolean> {
        if (userId === SYSTEM_USER) {
            return true;
        }

        const objectId = ObjectId.create("workspace", workspaceId);
        const req = v1.CheckPermissionRequest.create({
            subject: subject("user", userId),
            permission,
            resource: object("workspace", workspaceId),
        });

        return this.check(objectId, req, { userId }, forceEnablement);
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
        if (!(await isFgaWritesEnabled(userId))) {
            return;
        }
        const responses = await this.authorizer.deleteRelationships(
            v1.DeleteRelationshipsRequest.create({
                relationshipFilter: {
                    resourceType: type,
                    optionalResourceId: id,
                },
            }),
        );
        const readAt = responses[0].readAt;
        if (readAt) {
            await this.tokenCache.set(ObjectId.create(type, id), readAt.token);
        }

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
        if (!(await isFgaWritesEnabled(userId))) {
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

        const response = await this.authorizer.writeRelationships(...updates);
        const writtenAt = response?.writtenAt;
        if (writtenAt) {
            const objectIds = updates
                .map((r) => (r.relationship?.resource ? ObjectId.fromResource(r.relationship?.resource) : undefined))
                .filter((id) => !!id) as ObjectId[];
            await Promise.all(objectIds.map((id) => this.tokenCache.set(id, writtenAt.token)));
        }
    }

    async removeUser(userId: string) {
        if (!(await isFgaWritesEnabled(userId))) {
            return;
        }
        await this.removeAllRelationships(userId, "user", userId);
    }

    async addOrganizationRole(orgID: string, userID: string, role: TeamMemberRole): Promise<void> {
        if (!(await isFgaWritesEnabled(userID))) {
            return;
        }
        const updates = [set(rel.organization(orgID).member.user(userID))];
        if (role === "owner") {
            updates.push(set(rel.organization(orgID).owner.user(userID)));
        } else {
            updates.push(remove(rel.organization(orgID).owner.user(userID)));
        }
        const response = await this.authorizer.writeRelationships(...updates);
        const writtenAt = response?.writtenAt;
        if (writtenAt) {
            await this.tokenCache.set(ObjectId.create("organization", orgID), writtenAt.token);
        }
    }

    async removeOrganizationRole(orgID: string, userID: string, role: TeamMemberRole): Promise<void> {
        if (!(await isFgaWritesEnabled(userID))) {
            return;
        }
        const updates = [remove(rel.organization(orgID).owner.user(userID))];
        if (role === "member") {
            updates.push(remove(rel.organization(orgID).member.user(userID)));
        }
        const response = await this.authorizer.writeRelationships(...updates);
        const writtenAt = response?.writtenAt;
        if (writtenAt) {
            await this.tokenCache.set(ObjectId.create("organization", orgID), writtenAt.token);
        }
    }

    async addProjectToOrg(userId: string, orgID: string, projectID: string): Promise<void> {
        if (!(await isFgaWritesEnabled(userId))) {
            return;
        }
        const response = await this.authorizer.writeRelationships(set(rel.project(projectID).org.organization(orgID)));
        const writtenAt = response?.writtenAt;
        if (writtenAt) {
            await this.tokenCache.set(ObjectId.create("project", projectID), writtenAt.token);
        }
    }

    async setProjectVisibility(
        userId: string,
        projectID: string,
        organizationId: string,
        visibility: Project.Visibility,
    ) {
        if (!(await isFgaWritesEnabled(userId))) {
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
        const response = await this.authorizer.writeRelationships(...updates);
        const writtenAt = response?.writtenAt;
        if (writtenAt) {
            await this.tokenCache.set(ObjectId.create("project", projectID), writtenAt.token);
        }
    }

    async removeProjectFromOrg(userId: string, orgID: string, projectID: string): Promise<void> {
        if (!(await isFgaWritesEnabled(userId))) {
            return;
        }
        const response = await this.authorizer.writeRelationships(
            remove(rel.project(projectID).org.organization(orgID)), //
            remove(rel.project(projectID).viewer.anyUser),
            remove(rel.project(projectID).viewer.organization_member(orgID)),
        );
        const writtenAt = response?.writtenAt;
        if (writtenAt) {
            await this.tokenCache.set(ObjectId.create("project", projectID), writtenAt.token);
        }
    }

    async addOrganization(
        userId: string,
        orgId: string,
        members: { userId: string; role: TeamMemberRole }[],
        projectIds: string[],
    ): Promise<void> {
        if (!(await isFgaWritesEnabled(userId))) {
            return;
        }
        await this.addOrganizationMembers(orgId, members);

        await this.addOrganizationProjects(userId, orgId, projectIds);

        const response = await this.authorizer.writeRelationships(
            set(rel.organization(orgId).installation.installation), //
            set(rel.organization(orgId).snapshoter.organization_member(orgId)), //TODO allow orgs to opt-out of snapshotting
        );
        const writtenAt = response?.writtenAt;
        if (writtenAt) {
            await this.tokenCache.set(ObjectId.create("organization", orgId), writtenAt.token);
        }
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
        if (!(await isFgaWritesEnabled(userId))) {
            return;
        }
        const response = await this.authorizer.writeRelationships(
            set(rel.installation.admin.user(userId)), //
        );
        const writtenAt = response?.writtenAt;
        if (writtenAt) {
            await this.tokenCache.set(ObjectId.create("user", userId), writtenAt.token);
        }
    }

    async removeInstallationAdminRole(userId: string) {
        if (!(await isFgaWritesEnabled(userId))) {
            return;
        }
        const response = await this.authorizer.writeRelationships(
            remove(rel.installation.admin.user(userId)), //
        );
        const writtenAt = response?.writtenAt;
        if (writtenAt) {
            await this.tokenCache.set(ObjectId.create("user", userId), writtenAt.token);
        }
    }

    async addWorkspaceToOrg(orgID: string, userID: string, workspaceID: string, shared: boolean): Promise<void> {
        if (!(await isFgaWritesEnabled(userID))) {
            return;
        }
        const rels: v1.RelationshipUpdate[] = [];
        rels.push(set(rel.workspace(workspaceID).org.organization(orgID)));
        rels.push(set(rel.workspace(workspaceID).owner.user(userID)));
        if (shared) {
            rels.push(set(rel.workspace(workspaceID).shared.anyUser));
        }
        const response = await this.authorizer.writeRelationships(...rels);
        const writtenAt = response?.writtenAt;
        if (writtenAt) {
            await this.tokenCache.set(ObjectId.create("workspace", workspaceID), writtenAt.token);
        }

        (async () => {
            //TODO(se) remove this double checking once we're confident that the above works
            // check if the relationships were written
            try {
                const wsToOrgRel = await this.find(rel.workspace(workspaceID).org.organization(orgID));
                if (!wsToOrgRel) {
                    log.error("Failed to write workspace to org relationship", {
                        orgID,
                        userID,
                        workspaceID,

                        shared,
                    });
                }
                const wsToOwnerRel = await this.find(rel.workspace(workspaceID).owner.user(userID));
                if (!wsToOwnerRel) {
                    log.error("Failed to write workspace to owner relationship", {
                        orgID,
                        userID,
                        workspaceID,
                        shared,
                    });
                }
                if (shared) {
                    const wsSharedRel = await this.find(rel.workspace(workspaceID).shared.anyUser);
                    if (!wsSharedRel) {
                        log.error("Failed to write workspace shared relationship", {
                            orgID,
                            userID,
                            workspaceID,
                            shared,
                        });
                    }
                }
            } catch (error) {
                log.error("Failed to check workspace relationships", {
                    orgID,
                    userID,
                    workspaceID,
                    shared,
                    error,
                });
            }
        })().catch((error) => log.error({ userId: userID }, "Failed to check workspace relationships", { error }));
    }

    async removeWorkspaceFromOrg(orgID: string, userID: string, workspaceID: string): Promise<void> {
        if (!(await isFgaWritesEnabled(userID))) {
            return;
        }
        const response = await this.authorizer.writeRelationships(
            remove(rel.workspace(workspaceID).org.organization(orgID)),
            remove(rel.workspace(workspaceID).owner.user(userID)),
            remove(rel.workspace(workspaceID).shared.anyUser),
        );
        const writtenAt = response?.writtenAt;
        if (writtenAt) {
            await this.tokenCache.set(ObjectId.create("workspace", workspaceID), writtenAt.token);
        }
    }

    async setWorkspaceIsShared(userID: string, workspaceID: string, shared: boolean): Promise<void> {
        if (!(await isFgaWritesEnabled(userID))) {
            return;
        }
        const op = shared ? set : remove;
        const response = await this.authorizer.writeRelationships(op(rel.workspace(workspaceID).shared.anyUser));
        const writtenAt = response?.writtenAt;
        if (writtenAt) {
            await this.tokenCache.set(ObjectId.create("workspace", workspaceID), writtenAt.token);
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

    private async check(
        objectId: ObjectId,
        req: v1.CheckPermissionRequest,
        experimentsFields: {
            userId: string;
        },
        forceEnablement?: boolean,
    ): Promise<boolean> {
        function isWritePermission(permission: AllPermissions): boolean {
            switch (objectId.kind) {
                case "installation":
                    return InstallationPermission.isWritePermission(permission as InstallationPermission);
                case "user":
                    return UserPermission.isWritePermission(permission as UserPermission);
                case "organization":
                    return OrganizationPermission.isWritePermission(permission as OrganizationPermission);
                case "project":
                    return ProjectPermission.isWritePermission(permission as ProjectPermission);
                case "workspace":
                    return WorkspacePermission.isWritePermission(permission as WorkspacePermission);
            }
        }
        const isWrite = isWritePermission(req.permission as AllPermissions);

        req.consistency = await this.consistency(objectId, isWrite);
        const result = await this.authorizer.check(req, experimentsFields, forceEnablement);
        if (result.checkedAt) {
            if (isWrite) {
                await this.tokenCache.set(objectId, result.checkedAt);
            } else {
                // if this is not a write, this is just an optimization, so we don't care to wait
                this.tokenCache
                    .set(objectId, result.checkedAt)
                    .catch((err) =>
                        log.warn(
                            { objectId: ObjectId.toString(objectId) } as LogContext,
                            "Error updating ZedToken",
                            err,
                        ),
                    );
            }
        }
        return result.result;
    }

    private async consistency(objectId: ObjectId, isWrite: boolean): Promise<v1.Consistency> {
        function fullyConsistent() {
            return v1.Consistency.create({
                requirement: {
                    oneofKind: "fullyConsistent",
                    fullyConsistent: true,
                },
            });
        }
        if (isWrite) {
            return fullyConsistent();
        }
        const zedToken = await this.tokenCache.get(objectId);
        if (!zedToken) {
            return fullyConsistent();
        }
        return v1.Consistency.create({
            requirement: {
                oneofKind: "atLeastAsFresh",
                atLeastAsFresh: v1.ZedToken.create({
                    token: zedToken,
                }),
            },
        });
    }
}

export async function isFgaChecksEnabled(userId: string): Promise<boolean> {
    return getExperimentsClientForBackend().getValueAsync("centralizedPermissions", false, {
        user: {
            id: userId,
        },
    });
}

export async function isFgaWritesEnabled(userId: string): Promise<boolean> {
    const result = await getExperimentsClientForBackend().getValueAsync("spicedb_relationship_updates", false, {
        user: {
            id: userId,
        },
    });
    return result || (await isFgaChecksEnabled(userId));
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

function asSet<T>(array: (T | undefined)[]): Set<T> {
    const result = new Set<T>();
    for (const r of array) {
        if (r) {
            result.add(r);
        }
    }
    return result;
}
