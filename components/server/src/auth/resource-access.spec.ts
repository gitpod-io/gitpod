/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { suite, test } from "mocha-typescript";
import * as chai from 'chai';
const expect = chai.expect;
import { TokenResourceGuard, ScopedResourceGuard, GuardedResource, ResourceAccessOp, GuardEnvVar, WorkspaceEnvVarAccessGuard, TeamMemberResourceGuard, GuardedWorkspace } from "./resource-access";
import { UserEnvVar } from "@gitpod/gitpod-protocol/lib/protocol";

@suite class TestResourceAccess {

    @test public async areScopesSubsetOf() {
        const tests: {
            name: string
            upper: string[]
            lower: string[]
            isSubset: boolean
        }[] = [
                { name: "empty scopes", upper: [], lower: [], isSubset: true },
                { name: "empty upper, function lower", upper: [], lower: ["function:foo"], isSubset: false },
                { name: "empty upper, resource lower", upper: [], lower: ["resource:workspace::foobar::get"], isSubset: false },
                { name: "resource default upper, resource lower", upper: ["resource:default"], lower: ["resource:workspace::foobar::get"], isSubset: false },
                { name: "resource upper, empty lower", upper: ["resource:workspace::foobar::get"], lower: [], isSubset: true },
                { name: "resource upper, one op less lower", upper: ["resource:workspace::foobar::get/create"], lower: ["resource:workspace::foobar::get"], isSubset: true },
                { name: "resource upper, different resource lower", upper: ["resource:workspace::foobar::get/create"], lower: ["resource:workspace::blabla::get"], isSubset: false },
                { name: "function upper, empty lower", upper: ["function:foo"], lower: [], isSubset: true },
                { name: "function upper, function lower", upper: ["function:foo"], lower: ["function:foo"], isSubset: true },
                { name: "function upper, one function lower", upper: ["function:foo", "function:bar"], lower: ["function:foo"], isSubset: true },
            ];

        tests.forEach(t => {
            const res = TokenResourceGuard.areScopesSubsetOf(t.upper, t.lower);
            expect(res).to.be.eq(t.isSubset, `"${t.name}" expected areScopesSubsetOf(upper, lower) === ${t.isSubset}, but was ${res}`);
        });
    }

    @test public async scopedResourceGuardIsAllowedUnder() {
        const tests: {
            name: string
            parent: ScopedResourceGuard.ResourceScope
            child: ScopedResourceGuard.ResourceScope
            isAllowed: boolean
        }[] = [
                { name: "different kind", isAllowed: false, parent: { kind: "workspace", subjectID: "foo", operations: ["get"] }, child: { kind: "workspaceInstance", subjectID: "foo", operations: ["get"] } },
                { name: "different subject", isAllowed: false, parent: { kind: "workspace", subjectID: "foo", operations: ["get"] }, child: { kind: "workspace", subjectID: "somethingElse", operations: ["get"] } },
                { name: "new op", isAllowed: false, parent: { kind: "workspace", subjectID: "foo", operations: ["get"] }, child: { kind: "workspace", subjectID: "foo", operations: ["get", "create"] } },
                { name: "fewer ops", isAllowed: true, parent: { kind: "workspace", subjectID: "foo", operations: ["get", "create"] }, child: { kind: "workspace", subjectID: "foo", operations: ["get"] } },
                { name: "exact match", isAllowed: true, parent: { kind: "workspace", subjectID: "foo", operations: ["get"] }, child: { kind: "workspace", subjectID: "foo", operations: ["get"] } },
                { name: "no ops", isAllowed: true, parent: { kind: "workspace", subjectID: "foo", operations: [] }, child: { kind: "workspace", subjectID: "foo", operations: [] } },
            ];

        tests.forEach(t => {
            const res = ScopedResourceGuard.isAllowedUnder(t.parent, t.child);
            expect(res).to.be.eq(t.isAllowed, `"${t.name}" expected isAllowedUnder(parent, child) === ${t.isAllowed}, but was ${res}`);
        });
    }

    @test public async teamMemberResourceGuard() {
        const tests: {
            name: string
            userId: string
            resource: GuardedWorkspace
            isAllowed: boolean
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
                        teamMembers: [{
                            userId:"foo",
                            memberSince: "2021-08-31",
                            role: "member"
                        }]
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
                        teamMembers: [{
                            userId:"foo",
                            memberSince: "2021-08-31",
                            role: "member"
                        }]
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
                        teamMembers: [{
                            userId:"foo",
                            memberSince: "2021-08-31",
                            role: "member"
                        }]
                    },
                },
            ];

        for (const t of tests) {
            const res = new TeamMemberResourceGuard(t.userId);
            expect(await res.canAccess(t.resource, "get")).to.be.eq(t.isAllowed, `"${t.name}" expected canAccess(resource, "get") === ${t.isAllowed}, but was ${res}`);
        }
    }

    @test public async tokenResourceGuardCanAccess() {
        const workspaceResource: GuardedResource = { kind: "workspace", subject: { id: "wsid", ownerId: "foo" } as any };
        const tests: {
            name: string
            guard: TokenResourceGuard
            resource?: GuardedResource,
            operation?: ResourceAccessOp,
            expectation: boolean
        }[] = [
                {
                    name: "no scopes",
                    guard: new TokenResourceGuard(workspaceResource.subject.ownerId, []),
                    expectation: false,
                },
                {
                    name: "default scope positive",
                    guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [TokenResourceGuard.DefaultResourceScope]),
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
                        "resource:" + ScopedResourceGuard.marshalResourceScopeFromResource(workspaceResource, ["get"]),
                    ]),
                    expectation: true,
                },
                {
                    name: "default and explicit scope",
                    guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                        "resource:default",
                        "resource:" + ScopedResourceGuard.marshalResourceScopeFromResource(workspaceResource, ["create"]),
                    ]),
                    expectation: true,
                },
                {
                    name: "delegate scopes delegate to owner resource guard",
                    guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                        "resource:" + ScopedResourceGuard.marshalResourceScope({ kind: "workspace", subjectID: "*", operations: ["get"] }),
                    ]),
                    expectation: true,
                },
                {
                    name: "snaphshot create",
                    guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                        "resource:" + ScopedResourceGuard.marshalResourceScope({ kind: "snapshot", subjectID: ScopedResourceGuard.SNAPSHOT_WORKSPACE_SUBJECT_ID_PREFIX + workspaceResource.subject.id, operations: ["create"] }),
                    ]),
                    resource: { kind: "snapshot", subject: undefined, workspaceID: workspaceResource.subject.id, workspaceOwnerID: workspaceResource.subject.ownerId },
                    operation: "create",
                    expectation: true,
                },
                {
                    name: "snaphshot create missing prefix fails",
                    guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                        "resource:" + ScopedResourceGuard.marshalResourceScope({ kind: "snapshot", subjectID: workspaceResource.subject.id, operations: ["create"] }),
                    ]),
                    resource: { kind: "snapshot", subject: undefined, workspaceID: workspaceResource.subject.id, workspaceOwnerID: workspaceResource.subject.ownerId },
                    operation: "create",
                    expectation: false,
                },
                {
                    name: "snaphshot create other user fails",
                    guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                        "resource:" + ScopedResourceGuard.marshalResourceScope({ kind: "snapshot", subjectID: workspaceResource.subject.id, operations: ["create"] }),
                    ]),
                    resource: { kind: "snapshot", subject: undefined, workspaceID: workspaceResource.subject.id, workspaceOwnerID: "other_owner" },
                    operation: "create",
                    expectation: false,
                },
            ]

        await Promise.all(tests.map(async t => {
            const res = await t.guard.canAccess(t.resource || workspaceResource, t.operation || "get")
            expect(res).to.be.eq(t.expectation, `"${t.name}" expected canAccess(...) === ${t.expectation}, but was ${res}`);
        }))
    }

    @test public async scopedResourceGuardCanAccess() {
        const workspaceResource: GuardedResource = { kind: "workspace", subject: { id: "wsid", ownerId: "foo" } as any };
        const tests: {
            name: string
            guard: ScopedResourceGuard
            expectation: boolean
        }[] = [
                {
                    name: "no scopes",
                    guard: new ScopedResourceGuard([]),
                    expectation: false
                },
                {
                    name: "explicit scope",
                    guard: new ScopedResourceGuard([
                        { kind: workspaceResource.kind, subjectID: workspaceResource.subject.id, operations: ["get"] }
                    ]),
                    expectation: true
                },
                {
                    name: "explicit scope with different op",
                    guard: new ScopedResourceGuard([
                        { kind: workspaceResource.kind, subjectID: workspaceResource.subject.id, operations: ["create"] }
                    ]),
                    expectation: false
                },
                {
                    name: "delegate scope",
                    guard: new ScopedResourceGuard([
                        { kind: workspaceResource.kind, subjectID: "*", operations: ["get"] }
                    ], { canAccess: async () => true }),
                    expectation: true
                },
                {
                    name: "delegate scope has precedence",
                    guard: new ScopedResourceGuard([
                        { kind: workspaceResource.kind, subjectID: workspaceResource.subject.id, operations: ["get"] },
                        { kind: workspaceResource.kind, subjectID: "*", operations: ["get"] },
                    ], { canAccess: async () => "actually comes from delegate" as any }),
                    expectation: "actually comes from delegate" as any
                },
                {
                    name: "delegate scope matches ops",
                    guard: new ScopedResourceGuard([
                        { kind: workspaceResource.kind, subjectID: workspaceResource.subject.id, operations: ["get"] },
                        { kind: workspaceResource.kind, subjectID: "*", operations: ["create"] },
                    ], { canAccess: async () => "actually comes from delegate" as any }),
                    expectation: true
                },
                {
                    name: "delegate scope not configured",
                    guard: new ScopedResourceGuard([
                        { kind: workspaceResource.kind, subjectID: "*", operations: ["get"] },
                    ]),
                    expectation: false
                }
            ]

        await Promise.all(tests.map(async t => {
            const res = await t.guard.canAccess(workspaceResource, "get")
            expect(res).to.be.eq(t.expectation, `"${t.name}" expected canAccess(...) === ${t.expectation}, but was ${res}`);
        }))
    }

    @test public async workspaceEnvVarAccessGuardCanAccess() {
        const getEnvVarResourceScope: ScopedResourceGuard.ResourceScope<'envVar'> = { kind: 'envVar', subjectID: 'foo/x', operations: ['get'] };
        const tests: {
            name: string
            guard: ScopedResourceGuard
            guardEnvVar: GuardEnvVar
            operation: ResourceAccessOp
            expectation: boolean
        }[] = [
                {
                    name: "no scopes with any owner and repo",
                    guard: new WorkspaceEnvVarAccessGuard([]),
                    guardEnvVar: { kind: 'envVar', subject: { repositoryPattern: '*/*' } as UserEnvVar },
                    operation: 'get',
                    expectation: false
                },
                {
                    name: "explicit scope with any owner and repo",
                    guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                    guardEnvVar: { kind: 'envVar', subject: { repositoryPattern: '*/*' } as UserEnvVar },
                    operation: 'get',
                    expectation: true
                },
                {
                    name: "explicit scope with any owner and exact same repo",
                    guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                    guardEnvVar: { kind: 'envVar', subject: { repositoryPattern: '*/x' } as UserEnvVar },
                    operation: 'get',
                    expectation: true
                },
                {
                    name: "explicit scope with any owner and exact different repo",
                    guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                    guardEnvVar: { kind: 'envVar', subject: { repositoryPattern: '*/y' } as UserEnvVar },
                    operation: 'get',
                    expectation: false
                },
                {
                    name: "explicit scope with exact same owner and any repo",
                    guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                    guardEnvVar: { kind: 'envVar', subject: { repositoryPattern: 'foo/*' } as UserEnvVar },
                    operation: 'get',
                    expectation: true
                },
                {
                    name: "explicit scope with exact different owner and any repo",
                    guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                    guardEnvVar: { kind: 'envVar', subject: { repositoryPattern: 'bar/*' } as UserEnvVar },
                    operation: 'get',
                    expectation: false
                },
                {
                    name: "explicit scope with exact same owner and repo",
                    guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                    guardEnvVar: { kind: 'envVar', subject: { repositoryPattern: 'foo/x' } as UserEnvVar },
                    operation: 'get',
                    expectation: true
                },
                {
                    name: "explicit scope with exact same owner and exact different repo",
                    guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                    guardEnvVar: { kind: 'envVar', subject: { repositoryPattern: 'foo/y' } as UserEnvVar },
                    operation: 'get',
                    expectation: false
                },
                {
                    name: "explicit scope with exact same owner and repo",
                    guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                    guardEnvVar: { kind: 'envVar', subject: { repositoryPattern: 'foo/x' } as UserEnvVar },
                    operation: 'get',
                    expectation: true
                },
                {
                    name: "explicit scope with exact different owner and exact same repo",
                    guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                    guardEnvVar: { kind: 'envVar', subject: { repositoryPattern: 'bar/x' } as UserEnvVar },
                    operation: 'get',
                    expectation: false
                },
                {
                    name: "explicit scope with exact different owner and repo",
                    guard: new WorkspaceEnvVarAccessGuard([getEnvVarResourceScope]),
                    guardEnvVar: { kind: 'envVar', subject: { repositoryPattern: 'bar/y' } as UserEnvVar },
                    operation: 'get',
                    expectation: false
                },
            ]

        await Promise.all(tests.map(async t => {
            const res = await t.guard.canAccess(t.guardEnvVar, 'get')
            expect(res).to.be.eq(t.expectation, `"${t.name}" expected canAccess(...) === ${t.expectation}, but was ${res}`);
        }))
    }

}

module.exports = new TestResourceAccess();