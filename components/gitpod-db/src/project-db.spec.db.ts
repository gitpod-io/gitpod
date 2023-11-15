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
        const foundProject = await this.projectDb.findProjectsBySearchTerm({
            offset: 0,
            limit: 10,
            orderBy: "creationTime",
            orderDir: "DESC",
            searchTerm,
        });

        expect(foundProject.rows[0].id).to.eq(storedProject.id);

        const foundProjectByName = await this.projectDb.findProjectsBySearchTerm({
            offset: 0,
            limit: 10,
            orderBy: "creationTime",
            orderDir: "DESC",
            searchTerm: "some-proj",
        });
        expect(foundProjectByName.rows[0].id).to.eq(storedProject.id);

        const foundProjectEmptySearch = await this.projectDb.findProjectsBySearchTerm({
            offset: 0,
            limit: 10,
            orderBy: "creationTime",
            orderDir: "DESC",
            searchTerm: " ",
        });
        expect(foundProjectEmptySearch.rows[0].id).to.eq(storedProject.id);
    }

    @test()
    public async findProjectBySearchTermPagniation() {
        const user = await this.userDb.newUser();
        user.identities.push({
            authProviderId: "GitHub",
            authId: "1234",
            authName: "newUser",
            primaryEmail: "newuser@git.com",
        });
        await this.userDb.storeUser(user);

        const project1 = Project.create({
            name: "some-project",
            cloneUrl: "some-random-clone-url",
            teamId: "team-1",
            appInstallationId: "",
        });
        const project2 = Project.create({
            name: "some-project-2",
            cloneUrl: "some-random-clone-url-2",
            teamId: "team-1",
            appInstallationId: "",
        });
        const project3 = Project.create({
            name: "some-project-3",
            cloneUrl: "some-random-clone-url-1",
            teamId: "team-1",
            appInstallationId: "",
        });
        const project4 = Project.create({
            name: "some-project-4",
            cloneUrl: "some-random-clone-url-1",
            teamId: "team-1",
            appInstallationId: "",
        });
        const project5 = Project.create({
            name: "some-project-5",
            cloneUrl: "some-random-clone-url-1",
            teamId: "team-1",
            appInstallationId: "",
        });
        const storedProject1 = await this.projectDb.storeProject(project1);
        const storedProject2 = await this.projectDb.storeProject(project2);
        const storedProject3 = await this.projectDb.storeProject(project3);
        const storedProject4 = await this.projectDb.storeProject(project4);
        const storedProject5 = await this.projectDb.storeProject(project5);

        const allResults = await this.projectDb.findProjectsBySearchTerm({
            offset: 0,
            limit: 10,
            orderBy: "name",
            orderDir: "ASC",
        });
        expect(allResults.total).equals(5);
        expect(allResults.rows.length).equal(5);
        expect(allResults.rows[0].id).to.eq(storedProject1.id);
        expect(allResults.rows[1].id).to.eq(storedProject2.id);
        expect(allResults.rows[2].id).to.eq(storedProject3.id);
        expect(allResults.rows[3].id).to.eq(storedProject4.id);
        expect(allResults.rows[4].id).to.eq(storedProject5.id);

        const pageSize = 3;
        const page1 = await this.projectDb.findProjectsBySearchTerm({
            offset: 0,
            limit: pageSize,
            orderBy: "name",
            orderDir: "ASC",
        });
        expect(page1.total).equals(5);
        expect(page1.rows.length).equal(3);
        expect(page1.rows[0].id).to.eq(storedProject1.id);
        expect(page1.rows[1].id).to.eq(storedProject2.id);
        expect(page1.rows[2].id).to.eq(storedProject3.id);

        const page2 = await this.projectDb.findProjectsBySearchTerm({
            offset: pageSize * 1,
            limit: pageSize,
            orderBy: "name",
            orderDir: "ASC",
        });
        expect(page2.total).equals(5);
        expect(page2.rows.length).equal(2);
        expect(page2.rows[0].id).to.eq(storedProject4.id);
        expect(page2.rows[1].id).to.eq(storedProject5.id);
    }

    @test()
    public async findProjectBySearchTermOrganizationId() {
        const user = await this.userDb.newUser();
        user.identities.push({
            authProviderId: "GitHub",
            authId: "1234",
            authName: "newUser",
            primaryEmail: "newuser@git.com",
        });
        await this.userDb.storeUser(user);

        const project1 = Project.create({
            name: "some-project",
            cloneUrl: "some-random-clone-url",
            teamId: "team-1",
            appInstallationId: "",
        });
        const project2 = Project.create({
            name: "some-project-2",
            cloneUrl: "some-random-clone-url-2",
            teamId: "team-2",
            appInstallationId: "",
        });
        const storedProject1 = await this.projectDb.storeProject(project1);
        const storedProject2 = await this.projectDb.storeProject(project2);

        const team1Results = await this.projectDb.findProjectsBySearchTerm({
            offset: 0,
            limit: 10,
            orderBy: "name",
            orderDir: "ASC",
            organizationId: "team-1",
        });
        expect(team1Results.total).equals(1);
        expect(team1Results.rows[0].id).to.eq(storedProject1.id);

        const team2Results = await this.projectDb.findProjectsBySearchTerm({
            offset: 0,
            limit: 10,
            orderBy: "name",
            orderDir: "ASC",
            organizationId: "team-2",
        });
        expect(team2Results.total).equals(1);
        expect(team2Results.rows[0].id).to.eq(storedProject2.id);

        const noResults = await this.projectDb.findProjectsBySearchTerm({
            offset: 0,
            limit: 10,
            orderBy: "name",
            orderDir: "ASC",
            organizationId: "does-not-exist",
        });
        expect(noResults.total).equals(0);
    }
}

module.exports = new ProjectDBSpec();
