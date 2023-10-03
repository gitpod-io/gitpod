/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { suite, test, timeout } from "@testdeck/mocha";
import { testContainer } from "../test-container";
import { AuthCodeRepositoryDB } from "./auth-code-repository-db";
import { UserDB } from "../user-db";
import { DBOAuthAuthCodeEntry } from "./entity/db-oauth-auth-code";
import { TypeORM } from "./typeorm";
import * as chai from "chai";
import { User } from "@gitpod/gitpod-protocol";
import { resetDB } from "../test/reset-db";
const expect = chai.expect;

@suite(timeout(10000))
export class AuthCodeRepositoryDBSpec {
    private readonly codeDB = testContainer.get<AuthCodeRepositoryDB>(AuthCodeRepositoryDB);
    private readonly userDB = testContainer.get<UserDB>(UserDB);

    async before() {
        await this.wipeRepo();
    }

    async after() {
        await this.wipeRepo();
    }

    async wipeRepo() {
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        await resetDB(typeorm);
    }

    @test()
    async testPersistAndRead(): Promise<void> {
        let user = await this.userDB.newUser();
        user.identities.push({
            authProviderId: "GitHub",
            authId: "1234",
            authName: "newUser",
            primaryEmail: "newuser@git.com",
        });
        user = await this.userDB.storeUser(user);

        const code = this.createCode(user);
        await this.codeDB.persist(code);

        const persistedCodeEntry = await this.codeDB.getByIdentifier(code.code);
        expect(persistedCodeEntry.user, "persistedCodeEntry.user").not.to.be.undefined;
    }

    protected createCode(user: User) {
        // OAuth2 server layer
        const code = this.codeDB.issueAuthCode(
            {
                id: "foo-1",
                name: "foo",
                redirectUris: [],
                allowedGrants: [],
                scopes: [],
            },
            user,
            [],
        );
        // DBOAuthAuthCodeEntry layer
        const code2: DBOAuthAuthCodeEntry = {
            user: user as any, // this is as weak as it sounds :-(
            client: {} as any,
            code: code.code,
            codeChallenge: "abc",
            codeChallengeMethod: "plain",
            expiresAt: code.expiresAt,
            scopes: [],
            id: "foo1",
        };
        return code2;
    }
}
