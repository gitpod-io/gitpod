/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { DBUser, TypeORM, UserDB, testContainer } from "@gitpod/gitpod-db/lib";
import { DBTeam } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import { User } from "@gitpod/ide-service-api/lib/ide.pb";
import { fail } from "assert";
import * as chai from "chai";
import { Container, ContainerModule } from "inversify";
import "mocha";
import { v4 as uuidv4 } from "uuid";
import { Authorizer } from "../authorization/authorizer";
import { SpiceDBClient } from "../authorization/spicedb";
import { SpiceDBAuthorizer } from "../authorization/spicedb-authorizer";
import { OrganizationService } from "./organization-service";

const expect = chai.expect;

describe("OrganizationService", async () => {
    let container: Container;
    let owner: User;
    let stranger: User;

    beforeEach(async () => {
        container = testContainer.createChild();
        container.load(
            new ContainerModule((bind) => {
                bind(OrganizationService).toSelf().inSingletonScope();
                bind(SpiceDBClient)
                    .toDynamicValue(() => {
                        const token = uuidv4();
                        return v1.NewClient(token, "localhost:50051", v1.ClientSecurity.INSECURE_PLAINTEXT_CREDENTIALS)
                            .promises;
                    })
                    .inSingletonScope();
                bind(SpiceDBAuthorizer).toSelf().inSingletonScope();
                bind(Authorizer).toSelf().inSingletonScope();
            }),
        );
        Experiments.configureTestingClient({
            centralizedPermissions: true,
        });
        const userDB = container.get<UserDB>(UserDB);
        owner = await userDB.newUser();
        stranger = await userDB.newUser();
    });

    afterEach(async () => {
        // Clean-up database
        const typeorm = container.get(TypeORM);
        const dbConn = await typeorm.getConnection();
        await dbConn.getRepository(DBTeam).delete({});
        await (await typeorm.getConnection()).getRepository(DBUser).delete(owner.id);
    });

    it("should allow owners to get an invite", async () => {
        const os = container.get(OrganizationService);
        const org = await os.createOrganization(owner.id, "myorg");
        expect(org.name).to.equal("myorg");

        const invite = await os.getOrCreateInvite(owner.id, org.id);
        expect(invite).to.not.be.undefined;

        const invite2 = await os.getOrCreateInvite(owner.id, org.id);
        expect(invite2.id).to.equal(invite.id);

        const invite3 = await os.resetInvite(owner.id, org.id);
        expect(invite3.id).to.not.equal(invite.id);
    });

    //TODO it("should not allow members to get an invite", async () => { once the organizationService can maintain members

    it("should not allow strangers to get an invite", async () => {
        const os = container.get(OrganizationService);
        const org = await os.createOrganization(owner.id, "myorg");
        expect(org.name).to.equal("myorg");

        try {
            await os.getOrCreateInvite(stranger.id, org.id);
            fail("should have thrown");
        } catch (e) {
            expect(e.message).to.contain("not found");
        }

        // let's nmake sure an invite is created by the owner
        const invite = await os.getOrCreateInvite(owner.id, org.id);
        expect(invite).to.not.be.undefined;

        // still the invite should not be accessible to strangers
        try {
            await os.getOrCreateInvite(stranger.id, org.id);
            fail("should have thrown");
        } catch (e) {
            expect(e.message).to.contain("not found");
        }
    });
});
