/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chai from 'chai';
const expect = chai.expect;
import { suite, test } from 'mocha-typescript';
import { TypeORM } from './typeorm/typeorm';
import { TypeORMUserDBImpl } from './typeorm/user-db-impl';
import { testContainer } from './test-container';
import { ProjectDBImpl } from './typeorm/project-db-impl';
import { DBProject } from './typeorm/entity/db-project';
import { DBUser } from './typeorm/entity/db-user';
import { Project } from '@gitpod/gitpod-protocol';

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
        const manager = await typeorm.getConnection();
        await manager.getRepository(DBProject).delete({});
        await manager.getRepository(DBUser).delete({});
    }

    @test()
    public async findProjectBySearchTerm() {
        const user = await this.userDb.newUser();
        user.identities.push({
            authProviderId: 'GitHub',
            authId: '1234',
            authName: 'newUser',
            primaryEmail: 'newuser@git.com',
        });
        await this.userDb.storeUser(user);

        const project = Project.create({
            name: 'some-project',
            slug: 'some-project',
            cloneUrl: 'some-random-clone-url',
            userId: user.id,
            appInstallationId: 'app-1',
        });
        const searchTerm = 'rand';
        const storedProject = await this.projectDb.storeProject(project);
        const foundProject = await this.projectDb.findProjectsBySearchTerm(0, 10, 'creationTime', 'DESC', searchTerm);

        expect(foundProject.rows[0].id).to.eq(storedProject.id);
    }
}

module.exports = new ProjectDBSpec();
