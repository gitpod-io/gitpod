/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { suite, test } from "mocha-typescript";
import { APIUserService } from "./user";
import { Container } from "inversify";
import { testContainer } from "@gitpod/gitpod-db/lib";
import { API } from "./server";
import * as http from "http";
import { createConnectTransport } from "@bufbuild/connect-node";
import { Code, ConnectError, PromiseClient, createPromiseClient } from "@bufbuild/connect";
import { AddressInfo } from "net";
import { TeamsService as TeamsServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connectweb";
import { WorkspaceStarter } from "../workspace/workspace-starter";
import { UserService } from "../user/user-service";
import { APITeamsService } from "./teams";
import { v4 as uuidv4 } from "uuid";
import * as chai from "chai";
import { GetTeamRequest } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_pb";

const expect = chai.expect;

@suite()
export class APITeamsServiceSpec {
    private container: Container;
    private server: http.Server;

    private client: PromiseClient<typeof TeamsServiceDefinition>;

    async before() {
        this.container = testContainer.createChild();
        this.container.bind(API).toSelf().inSingletonScope();
        this.container.bind(APIUserService).toSelf().inSingletonScope();
        this.container.bind(APITeamsService).toSelf().inSingletonScope();

        this.container.bind(WorkspaceStarter).toConstantValue({} as WorkspaceStarter);
        this.container.bind(UserService).toConstantValue({} as UserService);

        this.server = this.container.get<API>(API).listen(0);

        const address = this.server.address() as AddressInfo;
        const transport = createConnectTransport({
            baseUrl: `http://localhost:${address.port}`,
            httpVersion: "1.1",
        });

        this.client = createPromiseClient(TeamsServiceDefinition, transport);
    }

    async after() {
        await new Promise((resolve, reject) => {
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

        for (let payload of payloads) {
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
}
