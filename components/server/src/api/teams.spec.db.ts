/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { Code, ConnectError, PromiseClient, createPromiseClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { Timestamp } from "@bufbuild/protobuf";
import { TeamDB, TypeORM, UserDB, testContainer } from "@gitpod/gitpod-db/lib";
import { DBTeam } from "@gitpod/gitpod-db/lib/typeorm/entity/db-team";
import { TeamsService as TeamsServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connect";
import { GetTeamRequest, Team, TeamMember, TeamRole } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";
import { suite, test, timeout } from "@testdeck/mocha";
import * as chai from "chai";
import * as http from "http";
import { Container } from "inversify";
import { AddressInfo } from "net";
import { Connection } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { UserAuthentication } from "../user/user-authentication";
import { WorkspaceService } from "../workspace/workspace-service";
import { API } from "./server";
import { SessionHandler } from "../session-handler";
import { Redis } from "ioredis";
import { UserService } from "../user/user-service";
import { Config } from "../config";
import { OrganizationService } from "../orgs/organization-service";
import { ProjectsService } from "../projects/projects-service";
import { AuthProviderService } from "../auth/auth-provider-service";
import { BearerAuth } from "../auth/bearer-authenticator";
import { EnvVarService } from "../user/env-var-service";
import { ScmService } from "../scm/scm-service";
import { ContextService } from "../workspace/context-service";
import { ContextParser } from "../workspace/context-parser-service";
import { SSHKeyService } from "../user/sshkey-service";
import { PrebuildManager } from "../prebuilds/prebuild-manager";
import { VerificationService } from "../auth/verification-service";
import { InstallationService } from "../auth/installation-service";
import { RateLimitter } from "../rate-limitter";
import { Authorizer } from "../authorization/authorizer";
import { AuditLogService } from "../audit/AuditLogService";
import { EntitlementService, EntitlementServiceImpl } from "../billing/entitlement-service";

const expect = chai.expect;

@suite(timeout(10000))
export class APITeamsServiceSpec {
    private container: Container;
    private server: http.Server;

    private client: PromiseClient<typeof TeamsServiceDefinition>;
    private dbConn: Connection;

    async before() {
        this.container = testContainer.createChild();
        API.bindAPI(this.container.bind.bind(this.container));

        this.container.bind(WorkspaceService).toConstantValue({} as WorkspaceService);
        this.container.bind(OrganizationService).toConstantValue({} as OrganizationService);
        this.container.bind(UserAuthentication).toConstantValue({} as UserAuthentication);
        this.container.bind(BearerAuth).toConstantValue({} as BearerAuth);
        this.container.bind(SessionHandler).toConstantValue({} as SessionHandler);
        this.container.bind(Config).toConstantValue({} as Config);
        this.container.bind(Redis).toConstantValue({} as Redis);
        this.container.bind(UserService).toConstantValue({} as UserService);
        this.container.bind(ProjectsService).toConstantValue({} as ProjectsService);
        this.container.bind(AuthProviderService).toConstantValue({} as AuthProviderService);
        this.container.bind(EnvVarService).toConstantValue({} as EnvVarService);
        this.container.bind(ScmService).toConstantValue({} as ScmService);
        this.container.bind(ContextService).toConstantValue({} as ContextService);
        this.container.bind(ContextParser).toConstantValue({} as ContextParser);
        this.container.bind(SSHKeyService).toConstantValue({} as SSHKeyService);
        this.container.bind(PrebuildManager).toConstantValue({} as PrebuildManager);
        this.container.bind(VerificationService).toConstantValue({} as VerificationService);
        this.container.bind(InstallationService).toConstantValue({} as InstallationService);
        this.container.bind(RateLimitter).toConstantValue({} as RateLimitter);
        this.container.bind(Authorizer).toConstantValue({} as Authorizer);
        this.container.bind(AuditLogService).toConstantValue({} as AuditLogService);
        this.container.bind(EntitlementService).toConstantValue({} as EntitlementServiceImpl);

        // Clean-up database
        const typeorm = testContainer.get<TypeORM>(TypeORM);
        this.dbConn = await typeorm.getConnection();
        await this.dbConn.getRepository(DBTeam).delete({});

        // Start an actual server for tests
        this.server = this.container.get<API>(API).listenPrivate();

        // Construct a client to point against our server
        const address = this.server.address() as AddressInfo;
        const transport = createConnectTransport({
            baseUrl: `http://localhost:${address.port}`,
            httpVersion: "1.1",
        });

        this.client = createPromiseClient(TeamsServiceDefinition, transport);
    }

    async after() {
        await new Promise((resolve, reject) => {
            if (!this.server) {
                return resolve(null);
            }

            this.server.close((err) => {
                if (err) {
                    return reject(err);
                }
                resolve(null);
            });
        });
    }

    @test async getTeam_invalidArgument() {
        const payloads = [
            new GetTeamRequest({}), // empty
            new GetTeamRequest({ teamId: "foo-bar" }), // not a valid UUID
        ];

        for (const payload of payloads) {
            try {
                await this.client.getTeam(payload);
                expect.fail("get team did not throw an exception");
            } catch (err) {
                expect(err).to.be.an.instanceof(ConnectError);
                expect(err.code).to.equal(Code.InvalidArgument);
            }
        }
    }

    @test async getTeam_notFoundWhenTeamDoesNotExist() {
        try {
            await this.client.getTeam(
                new GetTeamRequest({
                    teamId: uuidv4(),
                }),
            );
            expect.fail("get team did not throw an exception");
        } catch (err) {
            expect(err).to.be.an.instanceof(ConnectError);
            expect(err.code).to.equal(Code.NotFound);
        }
    }

    @test async getTeam_happy() {
        const teamDB = this.container.get<TeamDB>(TeamDB);
        const userDB = this.container.get<UserDB>(UserDB);
        const user = await userDB.storeUser(await userDB.newUser());
        const team = await teamDB.createTeam(user.id, "myteam");
        const invite = await teamDB.resetGenericInvite(team.id);

        const response = await this.client.getTeam(
            new GetTeamRequest({
                teamId: team.id,
            }),
        );
        expect(response.team).to.deep.equal(
            new Team({
                id: team.id,
                slug: team.slug,
                name: team.name,
                members: [
                    new TeamMember({
                        userId: user.id,
                        avatarUrl: user.avatarUrl,
                        fullName: user.fullName,
                        role: TeamRole.OWNER,
                        memberSince: Timestamp.fromDate(new Date(team.creationTime)),
                    }),
                ],
                teamInvitation: {
                    id: invite.id,
                },
            }),
        );
    }
}
