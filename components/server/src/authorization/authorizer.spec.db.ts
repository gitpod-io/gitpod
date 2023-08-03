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
import { Authorizer } from "./authorizer";
import { rel } from "./definitions";
import { v4 } from "uuid";

const expect = chai.expect;

describe("Authorizer", async () => {
    let container: Container;
    let authorizer: Authorizer;

    beforeEach(async () => {
        container = createTestContainer();
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        authorizer = container.get<Authorizer>(Authorizer);
    });

    afterEach(async () => {
        // Clean-up database
        await resetDB(container.get(TypeORM));
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
        await authorizer.addOrganization(orgId, [{ userId: u2, role: "member" }], [p2]);
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
