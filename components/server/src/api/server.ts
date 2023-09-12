/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, ConnectRouter, HandlerContext } from "@bufbuild/connect";
import { expressConnectMiddleware } from "@bufbuild/connect-express";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { HelloService } from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_connectweb";
import { StatsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/stats_connectweb";
import { TeamsService as TeamsServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connectweb";
import { UserService as UserServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/user_connectweb";
import { WorkspacesService as WorkspacesServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/workspaces_connectweb";
import express from "express";
import * as http from "http";
import { inject, injectable, interfaces } from "inversify";
import { AddressInfo } from "net";
import { SessionHandler } from "../session-handler";
import { APIHelloService } from "./dummy";
import { APIStatsService } from "./stats";
import { APITeamsService } from "./teams";
import { APIUserService } from "./user";
import { APIWorkspacesService } from "./workspaces";

@injectable()
export class API {
    @inject(APIUserService) private readonly apiUserService: APIUserService;
    @inject(APITeamsService) private readonly apiTeamService: APITeamsService;
    @inject(APIWorkspacesService) private readonly apiWorkspacesService: APIWorkspacesService;
    @inject(APIStatsService) private readonly apiStatsService: APIStatsService;
    @inject(APIHelloService) private readonly apiHelloService: APIHelloService;
    @inject(SessionHandler) private readonly sessionHandler: SessionHandler;

    listenPrivate(): http.Server {
        const app = express();
        this.registerPrivate(app);

        const server = app.listen(9877, () => {
            log.info(`Connect Private API server listening on port: ${(server.address() as AddressInfo).port}`);
        });

        return server;
    }

    listen(): http.Server {
        const app = express();
        this.register(app);

        const server = app.listen(3001, () => {
            log.info(`Connect Public API server listening on port: ${(server.address() as AddressInfo).port}`);
        });

        return server;
    }

    private registerPrivate(app: express.Application) {
        app.use(
            expressConnectMiddleware({
                routes: (router: ConnectRouter) => {
                    router.service(UserServiceDefinition, this.apiUserService);
                    router.service(TeamsServiceDefinition, this.apiTeamService);
                    router.service(WorkspacesServiceDefinition, this.apiWorkspacesService);
                    router.service(StatsService, this.apiStatsService);
                },
            }),
        );
    }

    private register(app: express.Application) {
        const self = this;
        const serviceInterceptor: ProxyHandler<any> = {
            get(target, prop, receiver) {
                const original = target[prop as any];
                if (typeof original !== "function") {
                    return Reflect.get(target, prop, receiver);
                }
                return async (...args: any[]) => {
                    const context = args[1] as HandlerContext;
                    await self.intercept(context);
                    return original.apply(target, args);
                };
            },
        };
        app.use(
            expressConnectMiddleware({
                routes: (router: ConnectRouter) => {
                    for (const service of [this.apiHelloService]) {
                        router.service(HelloService, new Proxy(service, serviceInterceptor));
                    }
                },
            }),
        );
    }

    /**
     * intercept handles cross-cutting concerns for all calls:
     * - authentication
     * TODO(ak):
     * - server-side observability (SLOs)
     * - rate limitting
     * - logging context
     * - tracing
     */
    private async intercept(context: HandlerContext): Promise<void> {
        const user = await this.verify(context);
        context.user = user;
    }

    private async verify(context: HandlerContext) {
        const user = await this.sessionHandler.verify(context.requestHeader.get("cookie"));
        if (!user) {
            throw new ConnectError("unauthenticated", Code.Unauthenticated);
        }
        return user;
    }

    static contribute(bind: interfaces.Bind): void {
        bind(APIHelloService).toSelf().inSingletonScope();
        bind(APIUserService).toSelf().inSingletonScope();
        bind(APITeamsService).toSelf().inSingletonScope();
        bind(APIWorkspacesService).toSelf().inSingletonScope();
        bind(APIStatsService).toSelf().inSingletonScope();
        bind(API).toSelf().inSingletonScope();
    }
}
