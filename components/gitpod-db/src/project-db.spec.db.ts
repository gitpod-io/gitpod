/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Project } from "@gitpod/gitpod-protocol";
import { suite, test } from "@testdeck/mocha";
import * as chai from "chai";
import { testContainer } from "./test-container";
import { resetDB } from "./test/reset-db";
import { ProjectDBImpl } from "./typeorm/project-db-impl";
import { TypeORM } from "./typeorm/typeorm";
import { TypeORMUserDBImpl } from "./typeorm/user-db-impl";
const expect = chai.expect;

@suite
class ProjectDBSpec {
    projectDb = testContainer.get<ProjectDBImpl>(ProjectDBImpl);
    userDb = testContainer.get<TypeORMUserDBImpl>(TypeORMUserDBImpl);

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
    public async findProjectBySearchTerm() {
        const user = await this.userDb.newUser();
        user.identities.push({
            authProviderId: "GitHub",
            authId: "1234",
            authName: "newUser",
            primaryEmail: "newuser@git.com",
        });
        await this.userDb.storeUser(user);

        const project = Project.create({
            name: "some-project",
            cloneUrl: "some-random-clone-url",
            teamId: "team-1",
            appInstallationId: "app-1",
        });
        const searchTerm = "rand";
        const storedProject = await this.projectDb.storeProject(project);
        const foundProject = await this.projectDb.findProjectsBySearchTerm(0, 10, "creationTime", "DESC", searchTerm);

        expect(foundProject.rows[0].id).to.eq(storedProject.id);

        const foundProjectByName = await this.projectDb.findProjectsBySearchTerm(
            0,
            10,
            "creationTime",
            "DESC",
            "some-proj",
        );
        expect(foundProjectByName.rows[0].id).to.eq(storedProject.id);
    }
}

module.exports = new ProjectDBSpec();
