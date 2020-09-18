import { suite, test } from "mocha-typescript";
import * as chai from 'chai';
const expect = chai.expect;
import { TokenResourceGuard, ScopedResourceGuard, GuardedResource } from "./resource-access";

@suite class TestResourceAccess {

    @test public async areScopesSubsetOf() {
        const tests: {
            name: string
            upper: string[]
            lower: string[]
            isSubset: boolean
        }[] = [
            {name: "empty scopes", upper: [], lower: [], isSubset: true},
            {name: "empty upper, function lower", upper: [], lower: ["function:foo"], isSubset: false},
            {name: "empty upper, resource lower", upper: [], lower: ["resource:workspace::foobar::get"], isSubset: false},
            {name: "resource default upper, resource lower", upper: ["resource:default"], lower: ["resource:workspace::foobar::get"], isSubset: false},
            {name: "resource upper, empty lower", upper: ["resource:workspace::foobar::get"], lower: [], isSubset: true},
            {name: "resource upper, one op less lower", upper: ["resource:workspace::foobar::get,create"], lower: ["resource:workspace::foobar::get"], isSubset: true},
            {name: "resource upper, different resource lower", upper: ["resource:workspace::foobar::get,create"], lower: ["resource:workspace::blabla::get"], isSubset: false},
            {name: "function upper, empty lower", upper: ["function:foo"], lower: [], isSubset: true},
            {name: "function upper, function lower", upper: ["function:foo"], lower: ["function:foo"], isSubset: true},
            {name: "function upper, one function lower", upper: ["function:foo", "function:bar"], lower: ["function:foo"], isSubset: true},
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
            {name: "different kind", isAllowed: false, parent: {kind: "workspace", subjectID: "foo", operations: ["get"]}, child: {kind: "workspaceInstance", subjectID: "foo", operations: ["get"]}},
            {name: "different subject", isAllowed: false, parent: {kind: "workspace", subjectID: "foo", operations: ["get"]}, child: {kind: "workspace", subjectID: "somethingElse", operations: ["get"]}},
            {name: "new op", isAllowed: false, parent: {kind: "workspace", subjectID: "foo", operations: ["get"]}, child: {kind: "workspace", subjectID: "foo", operations: ["get", "create"]}},
            {name: "fewer ops", isAllowed: true, parent: {kind: "workspace", subjectID: "foo", operations: ["get", "create"]}, child: {kind: "workspace", subjectID: "foo", operations: ["get"]}},
            {name: "exact match", isAllowed: true, parent: {kind: "workspace", subjectID: "foo", operations: ["get"]}, child: {kind: "workspace", subjectID: "foo", operations: ["get"]}},
            {name: "no ops", isAllowed: true, parent: {kind: "workspace", subjectID: "foo", operations: []}, child: {kind: "workspace", subjectID: "foo", operations: []}},
        ];

        tests.forEach(t => {
            const res = ScopedResourceGuard.isAllowedUnder(t.parent, t.child);
            expect(res).to.be.eq(t.isAllowed, `"${t.name}" expected isAllowedUnder(parent, child) === ${t.isAllowed}, but was ${res}`);
        });
    }

    @test public async tokenResourceGuardCanAccess() {
        const workspaceResource: GuardedResource = {kind: "workspace", subject: {id:"wsid", ownerId: "foo"} as any};
        const tests: {
            name: string
            guard: TokenResourceGuard
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
                    "resource:"+ScopedResourceGuard.marshalResourceScope(workspaceResource, ["get"]),
                ]), 
                expectation: true,
            },
            {
                name: "default and explicit scope", 
                guard: new TokenResourceGuard(workspaceResource.subject.ownerId, [
                    "resource:default",
                    "resource:"+ScopedResourceGuard.marshalResourceScope(workspaceResource, ["create"]),
                ]), 
                expectation: true,
            },
        ]

        await Promise.all(tests.map(async t => {
            const res = await t.guard.canAccess(workspaceResource, "get")
            expect(res).to.be.eq(t.expectation, `"${t.name}" expected canAccess(...) === ${t.expectation}, but was ${res}`);
        }))
    }

}

module.exports = new TestResourceAccess();