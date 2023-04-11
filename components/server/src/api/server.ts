/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as http from "http";
import * as express from "express";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { APITeamsService } from "./teams";
import { APIUserService } from "./user";
import { ConnectRouter } from "@bufbuild/connect";
import { expressConnectMiddleware } from "@bufbuild/connect-express";
import { UserService as UserServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/user_connectweb";
import { TeamsService as TeamsServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connectweb";
import { WorkspacesService as WorkspacesServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/workspaces_connectweb";
import { AddressInfo } from "net";
import { APIWorkspacesService } from "./workspaces";

@injectable()
export class API {
    @inject(APIUserService) protected readonly apiUserService: APIUserService;
    @inject(APITeamsService) protected readonly apiTeamService: APITeamsService;
    @inject(APIWorkspacesService) protected readonly apiWorkspacesService: APIWorkspacesService;

    public listen(port: number): http.Server {
        const app = express();
        this.register(app);

        const server = app.listen(9877, () => {
            log.info(`Connect API server listening on port: ${(server.address() as AddressInfo).port}`);
        });

        return server;
    }

    private register(app: express.Application) {
        app.use(
            expressConnectMiddleware({
                routes: (router: ConnectRouter) => {
                    router.service(UserServiceDefinition, this.apiUserService);
                    router.service(TeamsServiceDefinition, this.apiTeamService);
                    router.service(WorkspacesServiceDefinition, this.apiWorkspacesService);
                },
            }),
        );
    }
}
