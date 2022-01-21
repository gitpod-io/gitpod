/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import {
  ContextURL,
  GitpodToken,
  Snapshot,
  Team,
  TeamMemberInfo,
  Token,
  User,
  UserEnvVar,
  Workspace,
  WorkspaceInstance,
} from '@gitpod/gitpod-protocol';
import { HostContextProvider } from './host-context-provider';

declare var resourceInstance: GuardedResource;
export type GuardedResourceKind = typeof resourceInstance.kind;

export type GuardedResource =
  | GuardedWorkspace
  | GuardedWorkspaceInstance
  | GuardedUser
  | GuardedSnapshot
  | GuardedGitpodToken
  | GuardedToken
  | GuardedUserStorage
  | GuardedContentBlob
  | GuardEnvVar
  | GuardedTeam
  | GuardedWorkspaceLog;

const ALL_GUARDED_RESOURCE_KINDS = new Set<GuardedResourceKind>([
  'workspace',
  'workspaceInstance',
  'user',
  'snapshot',
  'gitpodToken',
  'token',
  'userStorage',
  'contentBlob',
  'envVar',
  'team',
  'workspaceLog',
]);
export function isGuardedResourceKind(kind: any): kind is GuardedResourceKind {
  return typeof kind === 'string' && ALL_GUARDED_RESOURCE_KINDS.has(kind as GuardedResourceKind);
}

export interface GuardedWorkspace {
  kind: 'workspace';
  subject: Workspace;
  teamMembers?: TeamMemberInfo[];
}

export interface GuardedWorkspaceInstance {
  kind: 'workspaceInstance';
  subject: WorkspaceInstance | undefined;
  workspace: Workspace;
  teamMembers?: TeamMemberInfo[];
}

export interface GuardedUser {
  kind: 'user';
  subject: User;
}

export interface GuardedSnapshot {
  kind: 'snapshot';
  subject: Snapshot | undefined;
  workspaceOwnerID: string;
  workspaceID?: string;
}

export interface GuardedUserStorage {
  kind: 'userStorage';
  userID: string;
  uri: string;
}

export interface GuardedContentBlob {
  kind: 'contentBlob';
  userID: string;
  name: string;
}

export interface GuardEnvVar {
  kind: 'envVar';
  subject: UserEnvVar;
}

export interface GuardedTeam {
  kind: 'team';
  subject: Team;
  members: TeamMemberInfo[];
}

export interface GuardedGitpodToken {
  kind: 'gitpodToken';
  subject: GitpodToken;
}

export interface GuardedToken {
  kind: 'token';
  subject: Token;
  tokenOwnerID: string;
}

export interface GuardedWorkspaceLog {
  kind: 'workspaceLog';
  subject: Workspace;
  teamMembers?: TeamMemberInfo[];
}

export type ResourceAccessOp = 'create' | 'update' | 'get' | 'delete';

export const ResourceAccessGuard = Symbol('ResourceAccessGuard');

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
    return (await Promise.all(this.children.map((c) => c.canAccess(resource, operation)))).some((x) => x);
  }
}

export class TeamMemberResourceGuard implements ResourceAccessGuard {
  constructor(readonly userId: string) {}

  async canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean> {
    switch (resource.kind) {
      case 'workspace':
        return await this.hasAccessToWorkspace(resource.subject, resource.teamMembers);
      case 'workspaceInstance':
        return await this.hasAccessToWorkspace(resource.workspace, resource.teamMembers);
      case 'workspaceLog':
        return await this.hasAccessToWorkspace(resource.subject, resource.teamMembers);
    }
    return false;
  }

  protected async hasAccessToWorkspace(workspace: Workspace, teamMembers?: TeamMemberInfo[]): Promise<boolean> {
    // prebuilds are accessible by team members.
    if (workspace.type === 'prebuild' && !!teamMembers) {
      return teamMembers.some((m) => m.userId === this.userId);
    }
    return false;
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
      case 'contentBlob':
        return resource.userID === this.userId;
      case 'gitpodToken':
        return resource.subject.user.id === this.userId;
      case 'snapshot':
        return resource.workspaceOwnerID === this.userId;
      case 'token':
        return resource.tokenOwnerID === this.userId;
      case 'user':
        return resource.subject.id === this.userId;
      case 'userStorage':
        return resource.userID === this.userId;
      case 'workspace':
        return resource.subject.ownerId === this.userId;
      case 'workspaceInstance':
        return resource.workspace.ownerId === this.userId;
      case 'envVar':
        return resource.subject.userId === this.userId;
      case 'team':
        switch (operation) {
          case 'create':
            // Anyone can create a new team.
            return true;
          case 'get':
            // Only members can get infos about a team.
            return resource.members.some((m) => m.userId === this.userId);
          case 'update':
          case 'delete':
            // Only owners can update or delete a team.
            return resource.members.some((m) => m.userId === this.userId && m.role === 'owner');
        }
      case 'workspaceLog':
        return resource.subject.ownerId === this.userId;
    }
  }
}

export class SharedWorkspaceAccessGuard implements ResourceAccessGuard {
  async canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean> {
    switch (resource.kind) {
      case 'workspace':
        return operation == 'get' && resource.subject.shareable === true;
      case 'workspaceInstance':
        return operation == 'get' && !!resource.workspace.shareable;
      default:
        return false;
    }
  }
}

export class ScopedResourceGuard<K extends GuardedResourceKind = GuardedResourceKind> implements ResourceAccessGuard {
  private readonly scopes = new Map<string, Set<ResourceAccessOp>>();

  constructor(scopes: ScopedResourceGuard.ResourceScope<K>[], protected readonly delegate?: ResourceAccessGuard) {
    for (const scope of scopes) {
      this.pushScope(scope);
    }
  }

  async canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean> {
    const subjectID = ScopedResourceGuard.subjectID(resource);
    if (!subjectID) {
      return false;
    }

    if (this.delegate && this.hasScope(`${resource.kind}::*`, operation)) {
      return this.delegate.canAccess(resource, operation);
    }

    return this.hasScope(`${resource.kind}::${subjectID}`, operation);
  }

  private hasScope(scope: string, operation: ResourceAccessOp): boolean {
    return !!this.scopes.get(scope)?.has(operation);
  }

  protected pushScope(scope: ScopedResourceGuard.ResourceScope<K>): void {
    this.scopes.set(`${scope.kind}::${scope.subjectID}`, new Set(scope.operations));
  }
}

export class WorkspaceEnvVarAccessGuard extends ScopedResourceGuard<'envVar'> {
  private readAccessWildcardPatterns: Set<string> | undefined;

  async canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean> {
    if (resource.kind !== 'envVar') {
      return false;
    }
    // allow read access based on wildcard repo patterns matching
    if (operation === 'get' && this.readAccessWildcardPatterns?.has(resource.subject.repositoryPattern)) {
      return true;
    }
    // but mutations only based on exact matching
    return super.canAccess(resource, operation);
  }

  protected pushScope(scope: ScopedResourceGuard.ResourceScope<'envVar'>): void {
    super.pushScope(scope);
    if (!scope.operations.includes('get')) {
      return;
    }
    const [owner, repo] = UserEnvVar.splitRepositoryPattern(scope.subjectID);
    this.readAccessWildcardPatterns = this.readAccessWildcardPatterns || new Set<string>();
    this.readAccessWildcardPatterns.add('*/*');
    this.readAccessWildcardPatterns.add(`${owner}/*`);
    this.readAccessWildcardPatterns.add(`*/${repo}`);
  }
}

export namespace ScopedResourceGuard {
  export const SNAPSHOT_WORKSPACE_SUBJECT_ID_PREFIX = 'ws-';

  export interface ResourceScope<K extends GuardedResourceKind = GuardedResourceKind> {
    kind: K;
    subjectID: string;
    operations: ResourceAccessOp[];
  }
  export function ofKind<K extends GuardedResourceKind>(scope: ResourceScope, kind: K): scope is ResourceScope<K> {
    return scope.kind === kind;
  }

  export function isAllowedUnder(parent: ResourceScope, child: ResourceScope): boolean {
    if (child.kind !== parent.kind) {
      return false;
    }
    if (child.subjectID !== parent.subjectID) {
      return false;
    }
    if (child.operations.some((co) => !parent.operations.includes(co))) {
      return false;
    }

    return true;
  }

  export function unmarshalResourceScope(scope: string): ResourceScope {
    const segs = scope.split('::');
    if (segs.length != 3) {
      throw new Error('invalid scope');
    }
    const kind = segs[0];
    if (!isGuardedResourceKind(kind)) {
      throw new Error('invalid resource kind');
    }
    let subjectID = segs[1];
    if (kind === 'envVar') {
      subjectID = UserEnvVar.normalizeRepoPattern(subjectID);
    }
    return {
      kind,
      subjectID,
      operations: segs[2].split('/').map((o) => o.trim()) as ResourceAccessOp[],
    };
  }

  export function marshalResourceScopeFromResource(resource: GuardedResource, ops: ResourceAccessOp[]): string {
    const subjectID = ScopedResourceGuard.subjectID(resource);
    if (!subjectID) {
      throw new Error('resource has no subject ID');
    }

    return marshalResourceScope({
      kind: resource.kind,
      subjectID,
      operations: ops,
    });
  }

  export function marshalResourceScope(scope: ResourceScope): string {
    return `${scope.kind}::${scope.subjectID}::${scope.operations.join('/')}`;
  }

  export function subjectID(resource: GuardedResource): string | undefined {
    switch (resource.kind) {
      case 'contentBlob':
        return `${resource.userID}:${resource.name}`;
      case 'gitpodToken':
        return resource.subject.tokenHash;
      case 'snapshot':
        if (resource.subject) {
          return resource.subject.id;
        }
        if (resource.workspaceID) {
          return SNAPSHOT_WORKSPACE_SUBJECT_ID_PREFIX + resource.workspaceID;
        }
        return undefined;
      case 'token':
        return resource.subject.value;
      case 'user':
        return resource.subject.id;
      case 'userStorage':
        return `${resource.userID}:${resource.uri}`;
      case 'workspace':
        return resource.subject.id;
      case 'workspaceInstance':
        return resource.subject ? resource.subject.id : undefined;
      case 'envVar':
        return resource.subject.repositoryPattern;
      case 'team':
      case 'workspaceLog':
        return resource.subject.id;
    }
  }
}

export class TokenResourceGuard implements ResourceAccessGuard {
  protected readonly delegate: ResourceAccessGuard;

  constructor(userID: string, protected readonly allTokenScopes: string[]) {
    const hasDefaultResourceScope = allTokenScopes.some((s) => s === TokenResourceGuard.DefaultResourceScope);
    const ownerResourceGuard = new OwnerResourceGuard(userID);

    if (hasDefaultResourceScope) {
      this.delegate = ownerResourceGuard;
    } else {
      const resourceScopes = TokenResourceGuard.getResourceScopes(allTokenScopes);
      const envVarScopes: ScopedResourceGuard.ResourceScope<'envVar'>[] = [];
      const otherScopes: ScopedResourceGuard.ResourceScope[] = [];
      for (const scope of resourceScopes) {
        if (ScopedResourceGuard.ofKind(scope, 'envVar')) {
          envVarScopes.push(scope);
        } else {
          otherScopes.push(scope);
        }
      }
      this.delegate = new ScopedResourceGuard(otherScopes, ownerResourceGuard);
      if (envVarScopes.length) {
        this.delegate = new CompositeResourceAccessGuard([
          new WorkspaceEnvVarAccessGuard(envVarScopes, ownerResourceGuard),
          this.delegate,
        ]);
      }
    }
  }

  async canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean> {
    if (resource.kind === 'gitpodToken' && operation === 'create') {
      return TokenResourceGuard.areScopesSubsetOf(this.allTokenScopes, resource.subject.scopes);
    }

    return this.delegate.canAccess(resource, operation);
  }
}

export namespace TokenResourceGuard {
  export const DefaultResourceScope = 'resource:default';

  export function getResourceScopes(s: string[]): ScopedResourceGuard.ResourceScope[] {
    return s
      .filter((s) => s.startsWith('resource:') && s !== DefaultResourceScope)
      .map((s) => ScopedResourceGuard.unmarshalResourceScope(s.substring('resource:'.length)));
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

    const allNewScopesAllowed = lowerResourceScopes.every((lrs) =>
      upperResourceScopes.some((urs) => ScopedResourceGuard.isAllowedUnder(urs, lrs)),
    );
    if (!allNewScopesAllowed) {
      return false;
    }

    const functionsAllowed = lowerScopes
      .filter((s) => s.startsWith('function:'))
      .every((ns) => upperScopes.includes(ns));
    if (!functionsAllowed) {
      return false;
    }

    return true;
  }
}

export class WorkspaceLogAccessGuard implements ResourceAccessGuard {
  constructor(protected readonly user: User, protected readonly hostContextProvider: HostContextProvider) {}

  async canAccess(resource: GuardedResource, operation: ResourceAccessOp): Promise<boolean> {
    if (resource.kind !== 'workspaceLog') {
      return false;
    }
    // only get operations are supported
    if (operation !== 'get') {
      return false;
    }

    // Check if user can access repositories headless logs
    const ws = resource.subject;
    const contextURL = ContextURL.parseToURL(ws.contextURL);
    if (!contextURL) {
      throw new Error(`unable to parse ContextURL: ${contextURL}`);
    }
    const hostContext = this.hostContextProvider.get(contextURL.hostname);
    if (!hostContext) {
      throw new Error(`no HostContext found for hostname: ${contextURL.hostname}`);
    }

    const svcs = hostContext.services;
    if (!svcs) {
      throw new Error(`no services found in HostContext for hostname: ${contextURL.hostname}`);
    }
    return svcs.repositoryService.canAccessHeadlessLogs(this.user, ws.context);
  }
}
