/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { DBUser, TypeORM, UserDB, testContainer } from "@gitpod/gitpod-db/lib";
import { DBTeam } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team";
import { DBProject } from "@gitpod/gitpod-db/lib/typeorm/entity/db-project";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";
import * as chai from "chai";
import { Container, ContainerModule } from "inversify";
import "mocha";
import { v4 as uuidv4 } from "uuid";
import { Authorizer } from "../authorization/authorizer";
import { SpiceDBClient } from "../authorization/spicedb";
import { SpiceDBAuthorizer } from "../authorization/spicedb-authorizer";
import { OrganizationService } from "../orgs/organization-service";
import { ProjectsService } from "./projects-service";
import { Config } from "../config";
import { AuthProviderService } from "../auth/auth-provider-service";
import { IAnalyticsWriter, NullAnalyticsWriter } from "@gitpod/gitpod-protocol/lib/analytics";
import { HostContainerMapping } from "../auth/host-container-mapping";
import { HostContextProvider, HostContextProviderFactory } from "../auth/host-context-provider";
import { AuthProviderParams } from "../auth/auth-provider";
import { HostContextProviderImpl } from "../auth/host-context-provider-impl";
import { Organization, User } from "@gitpod/gitpod-protocol";
import { ResponseError } from "vscode-ws-jsonrpc";

const expect = chai.expect;

describe("ProjectsService", async () => {
    let container: Container;
    let owner: User;
    let stranger: User;
    let org: Organization;

    beforeEach(async () => {
        container = testContainer.createChild();
        container.load(
            new ContainerModule((bind) => {
                bind(OrganizationService).toSelf().inSingletonScope();
                bind(ProjectsService).toSelf().inSingletonScope();
                bind(Config).toConstantValue({});
                bind(AuthProviderService).toSelf().inSingletonScope();
                bind(IAnalyticsWriter).toConstantValue(NullAnalyticsWriter);
                // hostcontext
                bind(HostContainerMapping).toSelf().inSingletonScope();
                bind(HostContextProviderFactory)
                    .toDynamicValue(({ container }) => ({
                        createHostContext: (config: AuthProviderParams) =>
                            HostContextProviderImpl.createHostContext(container, config),
                    }))
                    .inSingletonScope();
                bind(HostContextProvider).to(HostContextProviderImpl).inSingletonScope();

                // auth
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
        const orgService = container.get(OrganizationService);
        org = await orgService.createOrganization(owner.id, "my-org");
    });

    afterEach(async () => {
        // Clean-up database
        const typeorm = testContainer.get(TypeORM);
        const dbConn = await typeorm.getConnection();
        await dbConn.getRepository(DBTeam).delete({});
        await dbConn.getRepository(DBProject).delete({});
        const repo = (await typeorm.getConnection()).getRepository(DBUser);
        await repo.delete(owner.id);
        await repo.delete(stranger.id);
    });

    it("should let org owners create projects", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);
        expect(project).to.not.be.undefined;
    });

    it("should let owners find their projects", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        let foundProject = await ps.getProject(owner.id, project.id);
        expect(foundProject?.id).to.equal(project.id);
        const projects = await ps.getProjects(owner.id, org.id);
        expect(projects.length).to.equal(1);
    });

    it("should not let strangers find projects", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        const foundProject = await ps.getProject(stranger.id, project.id);
        expect(foundProject).to.be.undefined;

        const projects = await ps.getProjects(stranger.id, project.id);
        expect(projects.length).to.equal(0);
    });

    it("should not let strangers find projects", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);

        try {
            await ps.deleteProject(stranger.id, project.id);
            fail("should not be able to delete projects");
        } catch (error) {
            ResponseError;
            expect(error).to.not.be.undefined;
        }
    });

    it("should let owners delete their projects", async () => {
        const ps = container.get(ProjectsService);
        const project = await createTestProject(ps, org, owner);
        await ps.deleteProject(owner.id, project.id);

        let foundProject = await ps.getProject(owner.id, project.id);
        expect(foundProject).to.be.undefined;
        const projects = await ps.getProjects(owner.id, org.id);
        expect(projects.length).to.equal(0);
    });
});

async function createTestProject(ps: ProjectsService, org: Organization, owner: User) {
    return await ps.createProject(
        {
            name: "my-project",
            slug: "my-project",
            teamId: org.id,
            cloneUrl: "https://github.com/gipod-io/gitpod.git",
            appInstallationId: "noid",
        },
        owner,
    );
}
