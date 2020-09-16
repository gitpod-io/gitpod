import { Workspace, WorkspaceInstance, User, Snapshot, GitpodToken, Token } from "@gitpod/gitpod-protocol";
import { injectable } from "inversify";

export type GuardedResource =
    GuardedWorkspace |
    GuardedWorkspaceInstance |
    GuardedUser |
    GuardedSnapshot |
    GuardedGitpodToken |
    GuardedToken |
    GuardedUserStorage
;

export interface GuardedWorkspace {
    kind: "workspace";
    subject: Workspace;
}

export interface GuardedWorkspaceInstance {
    kind: "workspaceInstance";
    subject: WorkspaceInstance | undefined;
    workspaceOwnerID: string;
}

export interface GuardedUser {
    kind: "user";
    subject: User;
}

export interface GuardedSnapshot {
    kind: "snapshot";
    subject: Snapshot | undefined;
    workspaceOwnerID: string;
}

export interface GuardedUserStorage {
    kind: "userStorage";
    userID: string;
    uri: string;
}

export interface GuardedGitpodToken {
    kind: "gitpodToken";
    subject: GitpodToken;
}

export interface GuardedToken {
    kind: "token";
    subject: Token;
    tokenOwnerID: string;
}

export type ResourceAccessOp =
    "create" |
    "update" |
    "get"    |
    "delete"
;

export const ResourceAccessGuard = Symbol("ResourceAccessGuard");

export interface ResourceAccessGuard {
    canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean>;
}

/**
 * CompositeResourceAccessGuard grants access to resources if at least one of its children does.
 */
export class CompositeResourceAccessGuard implements ResourceAccessGuard {
    
    constructor(protected readonly children: ResourceAccessGuard[]) {}

    async canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean> {
        // if a single guard permitts access, we're good to go
        return (await Promise.all(this.children.map(c => c.canAccess(resource, operation)))).some(x => x);
    }

}

/**
 * OwnerResourceGuard grants access to resources if the user asking for access is the owner of that
 * resource.
 */
@injectable()
export class OwnerResourceGuard implements ResourceAccessGuard {

    constructor(readonly userId: string) {}

    async canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean> {
        switch (resource.kind) {
            case "gitpodToken":
                return resource.subject.user.id === this.userId;
            case "snapshot":
                return resource.workspaceOwnerID === this.userId;
            case "token":
                return resource.tokenOwnerID === this.userId;
            case "user":
                return resource.subject.id === this.userId;
            case "userStorage":
                return resource.userID === this.userId;
            case "workspace":
                return resource.subject.ownerId === this.userId;
            case "workspaceInstance":
                return resource.workspaceOwnerID === this.userId;
        }
    }

}
