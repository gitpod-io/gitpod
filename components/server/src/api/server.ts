/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, ConnectRouter, HandlerContext, ServiceImpl } from "@bufbuild/connect";
import { ServiceType, MethodKind } from "@bufbuild/protobuf";
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
import { connectServerHandled, connectServerStarted } from "../prometheus-metrics";

function service<T extends ServiceType>(type: T, impl: ServiceImpl<T>): [T, ServiceImpl<T>] {
    return [type, impl];
}

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
        app.use(
            expressConnectMiddleware({
                routes: (router: ConnectRouter) => {
                    for (const [type, impl] of [service(HelloService, this.apiHelloService)]) {
                        router.service(HelloService, new Proxy(impl, this.interceptService(type)));
                    }
                },
            }),
        );
    }

    /**
     * intercept handles cross-cutting concerns for all calls:
     * - authentication
     * - server-side observability
     * TODO(ak):
     * - rate limitting
     * - logging context
     * - tracing
     *
     * - add SLOs
     */

    private interceptService<T extends ServiceType>(type: T): ProxyHandler<ServiceImpl<T>> {
        const self = this;
        return {
            get(target, prop) {
                return async (...args: any[]) => {
                    const method = type.methods[prop as any];
                    if (!method) {
                        // Increment metrics for unknown method attempts
                        console.warn("public api: unknown method", type.typeName, prop);
                        const code = Code.InvalidArgument;
                        connectServerStarted.labels(type.typeName, "unknown", "unknown").inc();
                        connectServerHandled
                            .labels(type.typeName, "unknown", "unknown", Code[code].toLowerCase())
                            .observe(0);
                        throw new ConnectError("Invalid method", code);
                    }
                    let kind = "unknown";
                    if (method.kind === MethodKind.Unary) {
                        kind = "unary";
                    } else if (method.kind === MethodKind.ServerStreaming) {
                        kind = "server_stream";
                    } else if (method.kind === MethodKind.ClientStreaming) {
                        kind = "client_stream";
                    } else if (method.kind === MethodKind.BiDiStreaming) {
                        kind = "bidi";
                    }

                    const context = args[1] as HandlerContext;

                    const startTime = Date.now();
                    connectServerStarted.labels(type.typeName, method.name, kind).inc();

                    let result: any;
                    let error: ConnectError | undefined;
                    try {
                        const user = await self.verify(context);
                        context.user = user;
                        result = await (target[prop as any] as Function).apply(target, args);
                    } catch (e) {
                        if (!(e instanceof ConnectError)) {
                            console.error("public api: internal: failed to handle request", e);
                            error = new ConnectError("internal", Code.Internal);
                        } else {
                            error = e;
                        }
                    }

                    const code = error ? Code[error.code].toLowerCase() : "ok";
                    connectServerHandled
                        .labels(type.typeName, method.name, kind, code)
                        .observe((Date.now() - startTime) / 1000);
                    if (error) {
                        throw error;
                    }
                    return result;
                };
            },
        };
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
