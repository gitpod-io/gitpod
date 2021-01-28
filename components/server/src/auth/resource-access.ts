/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Workspace, WorkspaceInstance, User, Snapshot, GitpodToken, Token } from "@gitpod/gitpod-protocol";

declare var resourceInstance: GuardedResource;
export type GuardedResourceKind = typeof resourceInstance.kind;

export type GuardedResource =
    GuardedWorkspace |
    GuardedWorkspaceInstance |
    GuardedUser |
    GuardedSnapshot |
    GuardedGitpodToken |
    GuardedToken |
    GuardedUserStorage |
    GuardedContentBlob
;

export interface GuardedWorkspace {
    kind: "workspace";
    subject: Workspace;
}

export interface GuardedWorkspaceInstance {
    kind: "workspaceInstance";
    subject: WorkspaceInstance | undefined;
    workspaceOwnerID: string;
    workspaceIsShared: boolean;
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

export interface GuardedContentBlob {
    kind: "contentBlob";
    userID: string;
    name: string;
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


export interface WithResourceAccessGuard {
    resourceGuard?: ResourceAccessGuard;
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
export class OwnerResourceGuard implements ResourceAccessGuard {

    constructor(readonly userId: string) {}

    async canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean> {
        switch (resource.kind) {
            case "contentBlob":
                return resource.userID === this.userId;
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

export class SharedWorkspaceAccessGuard implements ResourceAccessGuard {

    async canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean> {
        switch (resource.kind) {
            case "workspace":
                return resource.subject.shareable === true;
            case "workspaceInstance":
                return !!resource.workspaceIsShared;
            default:
                return false;
        }
    }
}

export class ScopedResourceGuard implements ResourceAccessGuard {
    protected readonly scopes: { [index: string]: ScopedResourceGuard.ResourceScope } = {};

    constructor(scopes: ScopedResourceGuard.ResourceScope[], protected readonly delegate?: ResourceAccessGuard) {
        scopes.forEach(s => this.scopes[`${s.kind}::${s.subjectID}`] = s);
    }

    async canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean> {
        const subjectID = ScopedResourceGuard.subjectID(resource);
        if (!subjectID) {
            return false;
        }

        const defaultScope = this.scopes[`${resource.kind}::*`];
        if (!!this.delegate && !!defaultScope && defaultScope.operations.some(op => op === operation)) {
            return await this.delegate.canAccess(resource, operation);
        }

        const scope = this.scopes[`${resource.kind}::${subjectID}`];
        if (!scope) {
            return false;
        }

        return scope.operations.some(op => op === operation);
    }

}

export namespace ScopedResourceGuard {
    export interface ResourceScope {
        kind: GuardedResourceKind;
        subjectID: string;
        operations: ResourceAccessOp[];
    }

    export function isAllowedUnder(parent: ResourceScope, child: ResourceScope): boolean {
        if (child.kind !== parent.kind) {
            return false;
        }
        if (child.subjectID !== parent.subjectID) {
            return false;
        }
        if (child.operations.some(co => !parent.operations.includes(co))) {
            return false;
        }

        return true;
    }

    export function unmarshalResourceScope(scope: string): ResourceScope {
        const segs = scope.split("::");
        if (segs.length != 3) {
            throw new Error("invalid scope")
        }

        return {
            kind: segs[0] as GuardedResourceKind,
            subjectID: segs[1],
            operations: segs[2].split("/").map(o => o.trim()) as ResourceAccessOp[],
        };
    }

    export function marshalResourceScopeFromResource(resource: GuardedResource, ops: ResourceAccessOp[]): string {
        const subjectID = ScopedResourceGuard.subjectID(resource);
        if (!subjectID) {
            throw new Error("resource has no subject ID");
        }

        return marshalResourceScope({
            kind: resource.kind,
            subjectID,
            operations: ops,
        });
    }

    export function marshalResourceScope(scope: ResourceScope): string {
        return `${scope.kind}::${scope.subjectID}::${scope.operations.join("/")}`;
    }

    export function subjectID(resource: GuardedResource): string | undefined {
        switch (resource.kind) {
            case "contentBlob":
                return `${resource.userID}:${resource.name}`;
            case "gitpodToken":
                return resource.subject.tokenHash;
            case "snapshot":
                return resource.subject ? resource.subject.id : undefined;
            case "token":
                return resource.subject.value;
            case "user":
                return resource.subject.id;
            case "userStorage":
                return `${resource.userID}:${resource.uri}`;
            case "workspace":
                return resource.subject.id;
            case "workspaceInstance":
                return resource.subject ? resource.subject.id : undefined;
        }
    }
}

export class TokenResourceGuard implements ResourceAccessGuard {
    protected readonly delegate: ResourceAccessGuard;

    constructor(userID: string, protected readonly allTokenScopes: string[]) {
        const hasDefaultResourceScope = allTokenScopes.some(s => s === TokenResourceGuard.DefaultResourceScope);
        const ownerResourceGuard = new OwnerResourceGuard(userID);

        if (hasDefaultResourceScope) {
            this.delegate = ownerResourceGuard;
        } else {
            const resourceScopes = TokenResourceGuard.getResourceScopes(allTokenScopes);
            this.delegate = new ScopedResourceGuard(resourceScopes, ownerResourceGuard);
        }
    }

    async canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean> {
        if (resource.kind === "gitpodToken" && operation === "create") {
            return TokenResourceGuard.areScopesSubsetOf(this.allTokenScopes, resource.subject.scopes);
        }

        return this.delegate.canAccess(resource, operation);
    }

}

export namespace TokenResourceGuard {
    
    export const DefaultResourceScope = "resource:default";

    export function getResourceScopes(s: string[]): ScopedResourceGuard.ResourceScope[] {
        return s.filter(s => s.startsWith("resource:") && s !== DefaultResourceScope)
                .map(s => ScopedResourceGuard.unmarshalResourceScope(s.substring("resource:".length)));
    }

    export function areScopesSubsetOf(upperScopes: string[], lowerScopes: string[]) {
        /*
         * We need to ensure that the new token we're about to create doesn't exceed our own privileges.
         * For all "resource scopes" that means no new resource scope for which we don't have a corresponding one (ops_new <= ops_old).
         * For all "function scopes" that means no new function scopes for which we don't have a corresponding one.
         */

        // special case: default resource scope
        if (lowerScopes.includes(DefaultResourceScope) && !upperScopes.includes(DefaultResourceScope)) {
            return false;
        }

        const upperResourceScopes = TokenResourceGuard.getResourceScopes(upperScopes);
        const lowerResourceScopes = TokenResourceGuard.getResourceScopes(lowerScopes);

        const allNewScopesAllowed = lowerResourceScopes.every(lrs => upperResourceScopes.some(urs => ScopedResourceGuard.isAllowedUnder(urs, lrs)));
        if (!allNewScopesAllowed) {
            return false;
        }

        const functionsAllowed = lowerScopes
            .filter(s => s.startsWith("function:"))
            .every(ns => upperScopes.includes(ns));
        if (!functionsAllowed) {
            return false;
        }

        return true;
    }

}