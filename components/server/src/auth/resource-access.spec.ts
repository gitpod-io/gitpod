/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
const expect = chai.expect;
import {
    TokenResourceGuard,
    ScopedResourceGuard,
    GuardedResource,
    ResourceAccessOp,
    GuardEnvVar,
    WorkspaceEnvVarAccessGuard,
    TeamMemberResourceGuard,
    GuardedWorkspace,
    CompositeResourceAccessGuard,
    OwnerResourceGuard,
    GuardedResourceKind,
    RepositoryResourceGuard,
    SharedWorkspaceAccessGuard,
} from "./resource-access";
import { PrebuiltWorkspace, User, UserEnvVar, Workspace, WorkspaceType } from "@gitpod/gitpod-protocol/lib/protocol";
import {
    OrgMemberInfo,
    Organization,
    TeamMemberInfo,
    TeamMemberRole,
    WorkspaceInstance,
} from "@gitpod/gitpod-protocol";
import { HostContextProvider } from "./host-context-provider";

class MockedRepositoryResourceGuard extends RepositoryResourceGuard {
    constructor(protected repositoryAccess: boolean) {
        super({} as User, {} as HostContextProvider);
    }

    protected async hasAccessToRepos(workspace: Workspace): Promise<boolean> {
        return this.repositoryAccess;
    }
}

@suite
class TestResourceAccess {
    @test public async areScopesSubsetOf() {
        const tests: {
            name: string;
            upper: string[];
            lower: string[];
            isSubset: boolean;
        }[] = [
            { name: "empty scopes", upper: [], lower: [], isSubset: true },
            { name: "empty upper, function lower", upper: [], lower: ["function:foo"], isSubset: false },
            {
                name: "empty upper, resource lower",
                upper: [],
                lower: ["resource:workspace::foobar::get"],
                isSubset: false,
            },
            {
                name: "resource default upper, resource lower",
                upper: ["resource:default"],
                lower: ["resource:workspace::foobar::get"],
                isSubset: false,
            },
            {
                name: "resource upper, empty lower",
                upper: ["resource:workspace::foobar::get"],
                lower: [],
                isSubset: true,
            },
            {
                name: "resource upper, one op less lower",
                upper: ["resource:workspace::foobar::get/create"],
                lower: ["resource:workspace::foobar::get"],
                isSubset: true,
            },
            {
                name: "resource upper, different resource lower",
                upper: ["resource:workspace::foobar::get/create"],
                lower: ["resource:workspace::blabla::get"],
                isSubset: false,
            },
            { name: "function upper, empty lower", upper: ["function:foo"], lower: [], isSubset: true },
            {
                name: "function upper, function lower",
                upper: ["function:foo"],
                lower: ["function:foo"],
                isSubset: true,
            },
            {
                name: "function upper, one function lower",
                upper: ["function:foo", "function:bar"],
                lower: ["function:foo"],
                isSubset: true,
            },
        ];

        tests.forEach((t) => {
            const res = TokenResourceGuard.areScopesSubsetOf(t.upper, t.lower);
            expect(res).to.be.eq(
                t.isSubset,
                `"${t.name}" expected areScopesSubsetOf(upper, lower) === ${t.isSubset}, but was ${res}`,
            );
        });
    }

    @test public async scopedResourceGuardIsAllowedUnder() {
        const tests: {
            name: string;
            parent: ScopedResourceGuard.ResourceScope;
            child: ScopedResourceGuard.ResourceScope;
            isAllowed: boolean;
        }[] = [
            {
                name: "different kind",
                isAllowed: false,
                parent: { kind: "workspace", subjectID: "foo", operations: ["get"] },
                child: { kind: "workspaceInstance", subjectID: "foo", operations: ["get"] },
            },
            {
                name: "different subject",
                isAllowed: false,
                parent: { kind: "workspace", subjectID: "foo", operations: ["get"] },
                child: { kind: "workspace", subjectID: "somethingElse", operations: ["get"] },
            },
            {
                name: "new op",
                isAllowed: false,
                parent: { kind: "workspace", subjectID: "foo", operations: ["get"] },
                child: { kind: "workspace", subjectID: "foo", operations: ["get", "create"] },
            },
            {
                name: "fewer ops",
                isAllowed: true,
                parent: { kind: "workspace", subjectID: "foo", operations: ["get", "create"] },
                child: { kind: "workspace", subjectID: "foo", operations: ["get"] },
            },
            {
                name: "exact match",
                isAllowed: true,
                parent: { kind: "workspace", subjectID: "foo", operations: ["get"] },
                child: { kind: "workspace", subjectID: "foo", operations: ["get"] },
            },
            {
                name: "no ops",
                isAllowed: true,
                parent: { kind: "workspace", subjectID: "foo", operations: [] },
                child: { kind: "workspace", subjectID: "foo", operations: [] },
            },
        ];

        tests.forEach((t) => {
            const res = ScopedResourceGuard.isAllowedUnder(t.parent, t.child);
            expect(res).to.be.eq(
                t.isAllowed,
                `"${t.name}" expected isAllowedUnder(parent, child) === ${t.isAllowed}, but was ${res}`,
            );
        });
    }

    @test public async teamMemberResourceGuard() {
        const tests: {
            name: string;
            userId: string;
            resource: GuardedWorkspace;
            isAllowed: boolean;
        }[] = [
            {
                name: "member of team - no prebuild",
                userId: "foo",
                isAllowed: false,
                resource: {
                    kind: "workspace",
                    subject: {
                        id: "foobar",
                        ownerId: "foo",
                        type: "regular",
                    } as any,
                    teamMembers: [
                        {
                            userId: "foo",
                            memberSince: "2021-08-31",
                            role: "member",
                            ownedByOrganization: false,
                        },
                    ],
                },
            },
            {
                name: "member of team - prebuild",
                userId: "foo",
                isAllowed: true,
                resource: {
                    kind: "workspace",
                    subject: {
                        id: "foobar",
                        ownerId: "foo",
                        type: "prebuild",
                    } as any,
                    teamMembers: [
                        {
                            userId: "foo",
                            memberSince: "2021-08-31",
                            role: "member",
                            ownedByOrganization: false,
                        },
                    ],
                },
            },
            {
                name: "not a member of team - prebuild",
                userId: "bar",
                isAllowed: false,
                resource: {
                    kind: "workspace",
                    subject: {
                        id: "foobar",
                        ownerId: "foo",
                        type: "prebuild",
                    } as any,
                    teamMembers: [
                        {
                            userId: "foo",
                            memberSince: "2021-08-31",
                            role: "member",
                            ownedByOrganization: false,
                        },
                    ],
                },
            },
        ];

        for (const t of tests) {
            const res = new TeamMemberResourceGuard(t.userId);
            expect(await res.canAccess(t.resource, "get")).to.be.eq(
                t.isAllowed,
                `"${t.name}" expected canAccess(resource, "get") === ${t.isAllowed}, but was ${res}`,
            );
        }
    }

    @test public async organizationResourceGuard() {
        const user: User = {
            id: "123",
            name: "testuser",
            creationDate: new Date(2000, 1, 1).toISOString(),
            identities: [
                {
                    authId: "123",
                    authName: "testuser",
                    authProviderId: "github.com",
                },
            ],
        };

        const org: Organization = {
            id: "org-123",
            name: "test-org",
            creationTime: new Date(2000, 1, 1).toISOString(),
        };

        const noMember: OrgMemberInfo[] = [
            {
                userId: "foo",
                role: "member",
                memberSince: new Date(2000, 1, 1).toISOString(),
                ownedByOrganization: false,
            },
        ];

        const member: OrgMemberInfo[] = [
            {
                userId: user.id,
                role: "member",
                memberSince: new Date(2000, 1, 1).toISOString(),
                ownedByOrganization: false,
            },
        ];

        const memberAndOwned: OrgMemberInfo[] = [
            {
                userId: user.id,
                role: "member",
                memberSince: new Date(2000, 1, 1).toISOString(),
                ownedByOrganization: true,
            },
        ];

        const owner: OrgMemberInfo[] = [
            {
                userId: user.id,
                role: "owner",
                memberSince: new Date(2000, 1, 1).toISOString(),
                ownedByOrganization: false,
            },
        ];

        const ownerAndOwned: OrgMemberInfo[] = [
            {
                userId: user.id,
                role: "owner",
                memberSince: new Date(2000, 1, 1).toISOString(),
                ownedByOrganization: true,
            },
        ];

        const tests: {
            name: string;
            members: OrgMemberInfo[];
            permitted: ResourceAccessOp[];
        }[] = [
            // not even a member
            {
                name: "not a member",
                members: noMember,
                permitted: ["create"],
            },
            {
                name: "member",
                members: member,
                permitted: ["get", "create"],
            },
            {
                name: "member and owned",
                members: memberAndOwned,
                permitted: ["get"],
            },
            {
                name: "owner",
                members: owner,
                permitted: ["get", "update", "create", "delete"],
            },
            {
                name: "owner and owned",
                members: ownerAndOwned,
                permitted: ["get", "update"],
            },
        ];

        for (const t of tests) {
            const resourceGuard = new CompositeResourceAccessGuard([
                new OwnerResourceGuard(user.id),
                new TeamMemberResourceGuard(user.id),
                new SharedWorkspaceAccessGuard(),
                new MockedRepositoryResourceGuard(true),
            ]);

            for (const op of ["get", "update", "create", "delete"] as ResourceAccessOp[]) {
                const expectation = t.permitted.includes(op);
                const actual = await resourceGuard.canAccess({ kind: "team", subject: org, members: t.members }, op);

                expect(actual).to.be.eq(
                    expectation,
                    `"${t.name}" expected canAccess(resource, "${op}") === ${expectation}, but was ${actual}`,
                );
            }
        }
    }

    @test public async tokenResourceGuardCanAccess() {
        const workspaceResource: GuardedResource = {
            kind: "workspace",
            subject: { id: "wsid", ownerId: "foo" } as any,
        };
        const tests: {
            name: string;
            guard: TokenResourceGuard;
            resource?: GuardedResource;
            operation?: ResourceAccessOp;
            expectation: boolean;
        }[] = [
            {
                name: "no scopes",
                guard: new TokenResourceGuard(workspaceResource.subject.ownerId, []),
                expectation: false,
            },
            {
                name: "default scope positive",
                guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                    TokenResourceGuard.DefaultResourceScope,
                ]),
                expectation: true,
            },
            {
                name: "default scope negative",
                guard: new TokenResourceGuard("someoneElse", [TokenResourceGuard.DefaultResourceScope]),
                expectation: false,
            },
            {
                name: "explicit scope",
                guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                    `resource:${ScopedResourceGuard.marshalResourceScopeFromResource(workspaceResource, ["get"])}`,
                ]),
                expectation: true,
            },
            {
                name: "default and explicit scope",
                guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                    "resource:default",
                    `resource:${ScopedResourceGuard.marshalResourceScopeFromResource(workspaceResource, ["create"])}`,
                ]),
                expectation: true,
            },
            {
                name: "delegate scopes delegate to owner resource guard",
                guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                    `resource:${ScopedResourceGuard.marshalResourceScope({
                        kind: "workspace",
                        subjectID: "*",
                        operations: ["get"],
                    })}`,
                ]),
                expectation: true,
            },
            {
                name: "snaphshot create",
                guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                    `resource:${ScopedResourceGuard.marshalResourceScope({
                        kind: "snapshot",
                        subjectID:
                            ScopedResourceGuard.SNAPSHOT_WORKSPACE_SUBJECT_ID_PREFIX + workspaceResource.subject.id,
                        operations: ["create"],
                    })}`,
                ]),
                resource: { kind: "snapshot", subject: undefined, workspace: workspaceResource.subject },
                operation: "create",
                expectation: true,
            },
            {
                name: "snaphshot create missing prefix fails",
                guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                    `resource:${ScopedResourceGuard.marshalResourceScope({
                        kind: "snapshot",
                        subjectID: workspaceResource.subject.id,
                        operations: ["create"],
                    })}`,
                ]),
                resource: { kind: "snapshot", subject: undefined, workspace: workspaceResource.subject },
                operation: "create",
                expectation: false,
            },
            {
                name: "snaphshot create other user fails",
                guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                    `resource:${ScopedResourceGuard.marshalResourceScope({
                        kind: "snapshot",
                        subjectID: workspaceResource.subject.id,
                        operations: ["create"],
                    })}`,
                ]),
                resource: {
                    kind: "snapshot",
                    subject: undefined,
                    workspace: { ...workspaceResource.subject, ownerId: "other_owner" },
                },
                operation: "create",
                expectation: false,
            },
            {
                name: "snaphshot get",
                guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                    `resource:${ScopedResourceGuard.marshalResourceScope({
                        kind: "snapshot",
                        subjectID:
                            ScopedResourceGuard.SNAPSHOT_WORKSPACE_SUBJECT_ID_PREFIX + workspaceResource.subject.id,
                        operations: ["get"],
                    })}`,
                ]),
                resource: { kind: "snapshot", subject: undefined, workspace: workspaceResource.subject },
                operation: "get",
                expectation: true,
            },
        ];

        await Promise.all(
            tests.map(async (t) => {
                const res = await t.guard.canAccess(t.resource || workspaceResource, t.operation || "get");
                expect(res).to.be.eq(
                    t.expectation,
                    `"${t.name}" expected canAccess(...) === ${t.expectation}, but was ${res}`,
                );
            }),
        );
    }

    @test public async scopedResourceGuardCanAccess() {
        const workspaceResource: GuardedResource = {
            kind: "workspace",
            subject: { id: "wsid", ownerId: "foo" } as any,
        };
        const tests: {
            name: string;
            guard: ScopedResourceGuard;
            expectation: boolean;
        }[] = [
            {
                name: "no scopes",
                guard: new ScopedResourceGuard([]),
                expectation: false,
            },
            {
                name: "explicit scope",
                guard: new ScopedResourceGuard([
                    { kind: workspaceResource.kind, subjectID: workspaceResource.subject.id, operations: ["get"] },
                ]),
                expectation: true,
            },
            {
                name: "explicit scope with different op",
                guard: new ScopedResourceGuard([
                    { kind: workspaceResource.kind, subjectID: workspaceResource.subject.id, operations: ["create"] },
                ]),
                expectation: false,
            },
            {
                name: "delegate scope",
                guard: new ScopedResourceGuard(
                    [{ kind: workspaceResource.kind, subjectID: "*", operations: ["get"] }],
                    { canAccess: async () => true },
                ),
                expectation: true,
            },
            {
                name: "delegate scope has precedence",
                guard: new ScopedResourceGuard(
                    [
                        { kind: workspaceResource.kind, subjectID: workspaceResource.subject.id, operations: ["get"] },
                        { kind: workspaceResource.kind, subjectID: "*", operations: ["get"] },
                    ],
                    { canAccess: async () => "actually comes from delegate" as any },
                ),
                expectation: "actually comes from delegate" as any,
            },
            {
                name: "delegate scope matches ops",
                guard: new ScopedResourceGuard(
                    [
                        { kind: workspaceResource.kind, subjectID: workspaceResource.subject.id, operations: ["get"] },
                        { kind: workspaceResource.kind, subjectID: "*", operations: ["create"] },
                    ],
                    { canAccess: async () => "actually comes from delegate" as any },
                ),
                expectation: true,
            },
            {
                name: "delegate scope not configured",
                guard: new ScopedResourceGuard([{ kind: workspaceResource.kind, subjectID: "*", operations: ["get"] }]),
                expectation: false,
            },
        ];

        await Promise.all(
            tests.map(async (t) => {
                const res = await t.guard.canAccess(workspaceResource, "get");
                expect(res).to.be.eq(
                    t.expectation,
                    `"${t.name}" expected canAccess(...) === ${t.expectation}, but was ${res}`,
                );
            }),
        );
    }

    @test public async workspaceEnvVarAccessGuardCanAccess() {
        const getEnvVarResourceScope: ScopedResourceGuard.ResourceScope<"envVar"> = {
            kind: "envVar",
            subjectID: "foo/x",
            operations: ["get"],
        };
        const tests: {
            name: string;
            guard: ScopedResourceGuard;
            guardEnvVar: GuardEnvVar;
            operation: ResourceAccessOp;
            expectation: boolean;
        }[] = [
            {
                name: "no scopes with any owner and repo",
                guard: new WorkspaceEnvVarAccessGuard([]),
                guardEnvVar: { kind: "envVar", subject: { repositoryPattern: "*/*" } as UserEnvVar },
                operation: "get",
                expectation: false,
            },
            {
                name: "explicit scope with any owner and repo",
                guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                guardEnvVar: { kind: "envVar", subject: { repositoryPattern: "*/*" } as UserEnvVar },
                operation: "get",
                expectation: true,
            },
            {
                name: "explicit scope with any owner and exact same repo",
                guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                guardEnvVar: { kind: "envVar", subject: { repositoryPattern: "*/x" } as UserEnvVar },
                operation: "get",
                expectation: true,
            },
            {
                name: "explicit scope with any owner and exact different repo",
                guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                guardEnvVar: { kind: "envVar", subject: { repositoryPattern: "*/y" } as UserEnvVar },
                operation: "get",
                expectation: false,
            },
            {
                name: "explicit scope with exact same owner and any repo",
                guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                guardEnvVar: { kind: "envVar", subject: { repositoryPattern: "foo/*" } as UserEnvVar },
                operation: "get",
                expectation: true,
            },
            {
                name: "explicit scope with exact different owner and any repo",
                guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                guardEnvVar: { kind: "envVar", subject: { repositoryPattern: "bar/*" } as UserEnvVar },
                operation: "get",
                expectation: false,
            },
            {
                name: "explicit scope with exact same owner and repo",
                guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                guardEnvVar: { kind: "envVar", subject: { repositoryPattern: "foo/x" } as UserEnvVar },
                operation: "get",
                expectation: true,
            },
            {
                name: "explicit scope with exact same owner and exact different repo",
                guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                guardEnvVar: { kind: "envVar", subject: { repositoryPattern: "foo/y" } as UserEnvVar },
                operation: "get",
                expectation: false,
            },
            {
                name: "explicit scope with exact different owner and exact same repo",
                guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                guardEnvVar: { kind: "envVar", subject: { repositoryPattern: "bar/x" } as UserEnvVar },
                operation: "get",
                expectation: false,
            },
            {
                name: "explicit scope with exact different owner and repo",
                guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                guardEnvVar: { kind: "envVar", subject: { repositoryPattern: "bar/y" } as UserEnvVar },
                operation: "get",
                expectation: false,
            },
        ];

        await Promise.all(
            tests.map(async (t) => {
                const res = await t.guard.canAccess(t.guardEnvVar, "get");
                expect(res).to.be.eq(
                    t.expectation,
                    `"${t.name}" expected canAccess(...) === ${t.expectation}, but was ${res}`,
                );
            }),
        );
    }

    @test
    public async workspaceLikeResourceGuardsCanAcccess() {
        const createUser = (): User => {
            return {
                id: "123",
                name: "testuser",
                creationDate: new Date(2000, 1, 1).toISOString(),
                identities: [
                    {
                        authId: "123",
                        authName: "testuser",
                        authProviderId: "github.com",
                    },
                ],
            };
        };
        const otherUserId = "456";
        const organizationId = "org-123";

        const workspaceId = "ws-123";
        const createWorkspace = (ownerId: string, type: WorkspaceType): Workspace => {
            return {
                id: workspaceId,
                ownerId,
                organizationId,
                type,
                config: {},
                creationTime: new Date(2000, 1, 2).toISOString(),
                description: "test workspace ws-123",
                contextURL: "https://github.com/gitpod-io/gitpod",
                context: {
                    title: "gitpod-io/gitpod",
                    normalizedContextURL: "https://github.com/gitpod-io/gitpod",
                },
            };
        };
        const createInstance = (): WorkspaceInstance => {
            return {
                id: "wsi-123",
                workspaceId,
                creationTime: new Date(2000, 1, 2).toISOString(),
                region: "local",
                configuration: {
                    ideImage: "gitpod/workspace-full:latest",
                },
                status: {
                    version: 1,
                    conditions: {},
                    phase: "running",
                },
                ideUrl: "https://some.where",
                workspaceImage: "gitpod/workspace-full:latest",
            };
        };
        const createPrebuild = (): PrebuiltWorkspace => {
            return {
                id: "pws-123",
                buildWorkspaceId: workspaceId,
                cloneURL: "https://github.com/gitpod-io/gitpod",
                commit: "sha123123213",
                creationTime: new Date(2000, 1, 2).toISOString(),
                state: "available",
                statusVersion: 1,
            };
        };

        const tests: {
            name: string;
            resourceKind: GuardedResourceKind;
            isOwner: boolean;
            teamRole: TeamMemberRole | undefined;
            workspaceType: WorkspaceType;
            repositoryAccess?: boolean;
            expectation: boolean;
        }[] = [
            // regular workspaceLog
            {
                name: "regular workspaceLog get owner",
                resourceKind: "workspaceLog",
                workspaceType: "regular",
                isOwner: true,
                teamRole: undefined,
                expectation: true,
            },
            {
                name: "regular workspaceLog get other",
                resourceKind: "workspaceLog",
                workspaceType: "regular",
                isOwner: false,
                teamRole: undefined,
                expectation: false,
            },
            {
                name: "regular workspaceLog get team member",
                resourceKind: "workspaceLog",
                workspaceType: "regular",
                isOwner: false,
                teamRole: "member",
                expectation: false,
            },
            {
                name: "regular workspaceLog get team owner (same as member)",
                resourceKind: "workspaceLog",
                workspaceType: "regular",
                isOwner: false,
                teamRole: "owner",
                expectation: false,
            },
            // prebuild workspaceLog
            {
                name: "prebuild workspaceLog get owner",
                resourceKind: "workspaceLog",
                workspaceType: "prebuild",
                isOwner: true,
                teamRole: undefined,
                expectation: true,
            },
            {
                name: "prebuild workspaceLog get other",
                resourceKind: "workspaceLog",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: undefined,
                expectation: false,
            },
            {
                name: "prebuild workspaceLog get team member",
                resourceKind: "workspaceLog",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "member",
                expectation: true,
            },
            {
                name: "prebuild workspaceLog get team owner (same as member)",
                resourceKind: "workspaceLog",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "owner",
                expectation: true,
            },
            // prebuild workspaceLog with repo access
            {
                name: "prebuild workspaceLog get owner with repo access",
                resourceKind: "workspaceLog",
                workspaceType: "prebuild",
                isOwner: true,
                teamRole: undefined,
                repositoryAccess: true,
                expectation: true,
            },
            {
                name: "prebuild workspaceLog get other with repo access",
                resourceKind: "workspaceLog",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: undefined,
                repositoryAccess: true,
                expectation: true,
            },
            {
                name: "prebuild workspaceLog get team member with repo access",
                resourceKind: "workspaceLog",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "member",
                repositoryAccess: true,
                expectation: true,
            },
            {
                name: "prebuild workspaceLog get team owner (same as member)",
                resourceKind: "workspaceLog",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "owner",
                repositoryAccess: true,
                expectation: true,
            },
            // regular workspace
            {
                name: "regular workspace get owner",
                resourceKind: "workspace",
                workspaceType: "regular",
                isOwner: true,
                teamRole: undefined,
                expectation: true,
            },
            {
                name: "regular workspace get other",
                resourceKind: "workspace",
                workspaceType: "regular",
                isOwner: false,
                teamRole: undefined,
                expectation: false,
            },
            {
                name: "regular workspace get team member",
                resourceKind: "workspace",
                workspaceType: "regular",
                isOwner: false,
                teamRole: "member",
                expectation: false,
            },
            {
                name: "regular workspace get team owner (same as member)",
                resourceKind: "workspace",
                workspaceType: "regular",
                isOwner: false,
                teamRole: "owner",
                expectation: false,
            },
            // prebuild workspace
            {
                name: "prebuild workspace get owner",
                resourceKind: "workspace",
                workspaceType: "prebuild",
                isOwner: true,
                teamRole: undefined,
                expectation: true,
            },
            {
                name: "prebuild workspace get other",
                resourceKind: "workspace",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: undefined,
                expectation: false,
            },
            {
                name: "prebuild workspace get team member",
                resourceKind: "workspace",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "member",
                expectation: true,
            },
            {
                name: "prebuild workspace get team owner (same as member)",
                resourceKind: "workspace",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "owner",
                expectation: true,
            },
            // prebuild workspace with repo access
            {
                name: "prebuild workspace get owner",
                resourceKind: "workspace",
                workspaceType: "prebuild",
                isOwner: true,
                teamRole: undefined,
                repositoryAccess: true,
                expectation: true,
            },
            {
                name: "prebuild workspace get other",
                resourceKind: "workspace",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: undefined,
                repositoryAccess: true,
                expectation: true,
            },
            {
                name: "prebuild workspace get team member",
                resourceKind: "workspace",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "member",
                repositoryAccess: true,
                expectation: true,
            },
            {
                name: "prebuild workspace get team owner (same as member)",
                resourceKind: "workspace",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "owner",
                repositoryAccess: true,
                expectation: true,
            },
            // regular instance
            {
                name: "regular workspaceInstance get owner",
                resourceKind: "workspaceInstance",
                workspaceType: "regular",
                isOwner: true,
                teamRole: undefined,
                expectation: true,
            },
            {
                name: "regular workspaceInstance get other",
                resourceKind: "workspaceInstance",
                workspaceType: "regular",
                isOwner: false,
                teamRole: undefined,
                expectation: false,
            },
            {
                name: "regular workspaceInstance get team member",
                resourceKind: "workspaceInstance",
                workspaceType: "regular",
                isOwner: false,
                teamRole: "member",
                expectation: false,
            },
            {
                name: "regular workspaceInstance get team owner (same as member)",
                resourceKind: "workspaceInstance",
                workspaceType: "regular",
                isOwner: false,
                teamRole: "owner",
                expectation: false,
            },
            // prebuild instance
            {
                name: "prebuild workspaceInstance get owner",
                resourceKind: "workspaceInstance",
                workspaceType: "prebuild",
                isOwner: true,
                teamRole: undefined,
                expectation: true,
            },
            {
                name: "prebuild workspaceInstance get other",
                resourceKind: "workspaceInstance",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: undefined,
                expectation: false,
            },
            {
                name: "prebuild workspaceInstance get team member",
                resourceKind: "workspaceInstance",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "member",
                expectation: true,
            },
            {
                name: "prebuild workspaceInstance get team owner (same as member)",
                resourceKind: "workspaceInstance",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "owner",
                expectation: true,
            },
            // prebuild instance with repo access
            {
                name: "prebuild workspaceInstance get owner",
                resourceKind: "workspaceInstance",
                workspaceType: "prebuild",
                isOwner: true,
                teamRole: undefined,
                repositoryAccess: true,
                expectation: true,
            },
            {
                name: "prebuild workspaceInstance get other",
                resourceKind: "workspaceInstance",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: undefined,
                repositoryAccess: true,
                expectation: true,
            },
            {
                name: "prebuild workspaceInstance get team member",
                resourceKind: "workspaceInstance",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "member",
                repositoryAccess: true,
                expectation: true,
            },
            {
                name: "prebuild workspaceInstance get team owner (same as member)",
                resourceKind: "workspaceInstance",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "owner",
                repositoryAccess: true,
                expectation: true,
            },
            // prebuild
            {
                name: "prebuild get owner",
                resourceKind: "prebuild",
                workspaceType: "prebuild",
                isOwner: true,
                teamRole: undefined,
                expectation: true,
            },
            {
                name: "prebuild get other",
                resourceKind: "prebuild",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: undefined,
                expectation: false,
            },
            {
                name: "prebuild get team member",
                resourceKind: "prebuild",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "member",
                expectation: true,
            },
            {
                name: "prebuild get team owner (same as member)",
                resourceKind: "prebuild",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "owner",
                expectation: true,
            },
            // prebuild with repo access
            {
                name: "prebuild get owner",
                resourceKind: "prebuild",
                workspaceType: "prebuild",
                isOwner: true,
                teamRole: undefined,
                repositoryAccess: true,
                expectation: true,
            },
            {
                name: "prebuild get other",
                resourceKind: "prebuild",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: undefined,
                repositoryAccess: true,
                expectation: true,
            },
            {
                name: "prebuild get team member",
                resourceKind: "prebuild",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "member",
                repositoryAccess: true,
                expectation: true,
            },
            {
                name: "prebuild get team owner (same as member)",
                resourceKind: "prebuild",
                workspaceType: "prebuild",
                isOwner: false,
                teamRole: "owner",
                repositoryAccess: true,
                expectation: true,
            },
        ];

        for (const t of tests) {
            const user = createUser();
            const workspace = createWorkspace(t.isOwner ? user.id : otherUserId, t.workspaceType);
            const resourceGuard = new CompositeResourceAccessGuard([
                new OwnerResourceGuard(user.id),
                new TeamMemberResourceGuard(user.id),
                new SharedWorkspaceAccessGuard(),
                new MockedRepositoryResourceGuard(!!t.repositoryAccess),
            ]);
            const teamMembers: TeamMemberInfo[] = [];
            if (t.teamRole) {
                teamMembers.push({
                    userId: user.id,
                    role: t.teamRole,
                    memberSince: user.creationDate,
                    ownedByOrganization: false,
                });
            }

            const kind: GuardedResourceKind = t.resourceKind;
            let resource: GuardedResource | undefined = undefined;
            if (kind === "workspaceInstance") {
                const instance = createInstance();
                resource = { kind, subject: instance, workspace, teamMembers };
            } else if (kind === "workspaceLog") {
                resource = { kind, subject: workspace, teamMembers };
            } else if (kind === "workspace") {
                resource = { kind, subject: workspace, teamMembers };
            } else if (kind === "prebuild") {
                if (workspace.type !== "prebuild") {
                    throw new Error("invalid test data: PWS requires workspace to be of type prebuild!");
                }
                const prebuild = createPrebuild();
                resource = { kind, subject: prebuild, workspace, teamMembers };
            }
            if (!resource) {
                throw new Error(`unhandled GuardedResourceKind${kind}`);
            }

            const actual = await resourceGuard.canAccess(resource, "get");
            expect(actual).to.be.eq(
                t.expectation,
                `"${t.name}" expected canAccess(...) === ${t.expectation}, but was ${actual}`,
            );
        }
    }
}

module.exports = new TestResourceAccess();
