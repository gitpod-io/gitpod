/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { v1 } from "@authzed/authzed-node";
import { TypeORM } from "@gitpod/gitpod-db/lib";
import { resetDB } from "@gitpod/gitpod-db/lib/test/reset-db";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container } from "inversify";
import "mocha";
import { createTestContainer } from "../test/service-testing-container-module";
import { Authorizer, getSubjectFromCtx } from "./authorizer";
import { rel } from "./definitions";
import { v4 } from "uuid";
import { Subject, SubjectId } from "../auth/subject-id";
import { runWithRequestContext } from "../util/request-context";
import { fail } from "assert";
import { ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

const expect = chai.expect;

describe("Authorizer", async () => {
    let container: Container;
    let authorizer: Authorizer;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({});
        authorizer = container.get<Authorizer>(Authorizer);
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
        // Deactivate all services
        await container.unbindAllAsync();
    });

    it("should removeUser", async () => {
        const userId = v4();
        await authorizer.addUser(userId);
        await expected(rel.user(userId).installation.installation);
        await expected(rel.user(userId).self.user(userId));
        await expected(rel.installation.member.user(userId));

        await authorizer.removeUser(userId);
        await notExpected(rel.user(userId).installation.installation);
        await notExpected(rel.user(userId).self.user(userId));
        await notExpected(rel.installation.member.user(userId));
    });

    it("should addUser", async () => {
        const userId = v4();
        await notExpected(rel.user(userId).installation.installation);
        await notExpected(rel.user(userId).self.user(userId));
        await notExpected(rel.installation.member.user(userId));

        await authorizer.addUser(userId);

        await expected(rel.user(userId).installation.installation);
        await expected(rel.user(userId).self.user(userId));
        await expected(rel.installation.member.user(userId));

        // add user to org
        const org1Id = v4();
        await authorizer.addUser(userId, org1Id);

        await notExpected(rel.user(userId).installation.installation);
        await notExpected(rel.installation.member.user(userId));
        await expected(rel.user(userId).self.user(userId));
        await expected(rel.user(userId).organization.organization(org1Id));

        // add user to another org
        const org2Id = v4();
        await authorizer.addUser(userId, org2Id);

        await notExpected(rel.user(userId).installation.installation);
        await notExpected(rel.installation.member.user(userId));
        await notExpected(rel.user(userId).organization.organization(org1Id));
        await expected(rel.user(userId).self.user(userId));
        await expected(rel.user(userId).organization.organization(org2Id));

        // back to installation
        await authorizer.addUser(userId);

        await notExpected(rel.user(userId).organization.organization(org1Id));
        await notExpected(rel.user(userId).organization.organization(org2Id));

        await expected(rel.user(userId).installation.installation);
        await expected(rel.user(userId).self.user(userId));
        await expected(rel.installation.member.user(userId));
    });

    it("should addOrganization", async () => {
        const orgId = v4();
        await notExpected(rel.organization(orgId).installation.installation);

        // add org with members and projects
        const u1 = v4();
        const u2 = v4();
        const p1 = v4();
        const p2 = v4();
        await authorizer.addOrganization(
            "",
            orgId,
            [
                { userId: u1, role: "member" },
                { userId: u2, role: "owner" },
            ],
            [p1, p2],
        );

        await expected(rel.organization(orgId).installation.installation);
        await expected(rel.organization(orgId).member.user(u1));
        await expected(rel.organization(orgId).member.user(u2));
        await expected(rel.organization(orgId).owner.user(u2));
        await expected(rel.project(p1).org.organization(orgId));
        await expected(rel.project(p2).org.organization(orgId));

        // add org again with different members and projects
        await authorizer.addOrganization("", orgId, [{ userId: u2, role: "member" }], [p2]);
        await expected(rel.organization(orgId).installation.installation);
        await notExpected(rel.organization(orgId).member.user(u1));
        await expected(rel.organization(orgId).member.user(u2));
        await notExpected(rel.organization(orgId).owner.user(u2));
        await notExpected(rel.project(p1).org.organization(orgId));
        await expected(rel.project(p2).org.organization(orgId));
    });

    async function expected(relation: v1.Relationship): Promise<void> {
        const rs = await authorizer.find(relation);
        const message = async () => {
            const expected = JSON.stringify(relation);
            relation.subject = undefined;
            const result = await authorizer.find(relation);
            return `Expected ${expected} to be present, but it was not. Found ${JSON.stringify(result)}`;
        };
        expect(rs, await message()).to.not.be.undefined;
    }

    async function notExpected(relation: v1.Relationship): Promise<void> {
        const rs = await authorizer.find(relation);
        expect(rs).to.be.undefined;
    }
});

describe("getSubjectFromCtx", async () => {
    it("all tests", async () => {
        interface Test {
            name: string;
            passedSubject: Subject;
            contextSubjectId: SubjectId | undefined;
            authWithRequestContext: boolean;
            expected: SubjectId | number;
        }
        const tests: Test[] = [
            // Feature flag is OFF
            {
                name: "both given and match, ff off",
                passedSubject: "u1",
                contextSubjectId: SubjectId.fromUserId("u1"),
                authWithRequestContext: false,
                expected: SubjectId.fromUserId("u1"),
            },
            {
                name: "both given and mismatch, ff off",
                passedSubject: "u1",
                contextSubjectId: SubjectId.fromUserId("u2"),
                authWithRequestContext: false,
                expected: SubjectId.fromUserId("u1"),
            },
            {
                name: "passed only, ff off",
                passedSubject: "u1",
                contextSubjectId: undefined,
                authWithRequestContext: false,
                expected: SubjectId.fromUserId("u1"),
            },
            {
                name: "ctx only, ff off",
                passedSubject: undefined,
                contextSubjectId: SubjectId.fromUserId("u1"),
                authWithRequestContext: false,
                expected: ErrorCodes.PERMISSION_DENIED,
            },
            {
                name: "none passed, ff off",
                passedSubject: undefined,
                contextSubjectId: undefined,
                authWithRequestContext: false,
                expected: ErrorCodes.PERMISSION_DENIED,
            },
            // Feature flag is ON
            {
                name: "both given and match, ff on",
                passedSubject: "u1",
                contextSubjectId: SubjectId.fromUserId("u1"),
                authWithRequestContext: true,
                expected: SubjectId.fromUserId("u1"),
            },
            {
                name: "both given and mismatch, ff on",
                passedSubject: "u1",
                contextSubjectId: SubjectId.fromUserId("u2"),
                authWithRequestContext: true,
                expected: ErrorCodes.PERMISSION_DENIED,
            },
            {
                name: "passed only, ff on",
                passedSubject: "u1",
                contextSubjectId: undefined,
                authWithRequestContext: true,
                expected: ErrorCodes.PERMISSION_DENIED,
            },
            {
                name: "ctx only, ff on",
                passedSubject: undefined,
                contextSubjectId: SubjectId.fromUserId("u1"),
                authWithRequestContext: true,
                expected: SubjectId.fromUserId("u1"),
            },
            {
                name: "none passed, ff on",
                passedSubject: undefined,
                contextSubjectId: undefined,
                authWithRequestContext: true,
                expected: ErrorCodes.PERMISSION_DENIED,
            },
        ];

        for (const test of tests) {
            Experiments.configureTestingClient({
                authWithRequestContext: test.authWithRequestContext,
            });

            await runWithRequestContext(
                {
                    requestKind: "test",
                    requestMethod: test.name,
                    signal: new AbortController().signal,
                    subjectId: test.contextSubjectId,
                },
                async () => {
                    try {
                        const actual = await getSubjectFromCtx(test.passedSubject);
                        expect(actual, `${test.name}, expected ${test.expected}, got ${actual}`).to.deep.equal(
                            test.expected,
                        );
                    } catch (err) {
                        if (typeof test.expected === "number") {
                            expect(
                                err.code,
                                `${test.name}, expected ${test.expected}, got ${err.code} (${err.message})`,
                            ).to.equal(test.expected);
                        } else {
                            const msg = err?.message || JSON.stringify(err) || "unknown error";
                            fail(`${test.name}, ${msg}`);
                        }
                    }
                },
            );
        }
    });
});
