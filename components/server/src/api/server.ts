/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, ConnectRouter, HandlerContext, ServiceImpl } from "@bufbuild/connect";
import { expressConnectMiddleware } from "@bufbuild/connect-express";
import { MethodKind, ServiceType } from "@bufbuild/protobuf";
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
import { grpcServerHandled, grpcServerHandling, grpcServerStarted } from "../prometheus-metrics";
import { SessionHandler } from "../session-handler";
import { APIHelloService } from "./dummy";
import { APIStatsService } from "./stats";
import { APITeamsService } from "./teams";
import { APIUserService } from "./user";
import { APIWorkspacesService } from "./workspaces";
import { runWithContext } from "../util/log-context";
import { v4 } from "uuid";
import { performance } from "perf_hooks";

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
            log.info(`public api: listening on port: ${(server.address() as AddressInfo).port}`);
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
                        router.service(type, new Proxy(impl, this.interceptService(type)));
                    }
                },
            }),
        );
        // TODO(al) cover unhandled cases
    }

    /**
     * intercept handles cross-cutting concerns for all calls:
     * - authentication
     * - server-side observability
     * - logging context
     * TODO(ak):
     * - rate limitting
     * - tracing
     */
    private interceptService<T extends ServiceType>(type: T): ProxyHandler<ServiceImpl<T>> {
        const grpc_service = type.typeName;
        const self = this;
        return {
            get(target, prop) {
                return (...args: any[]) => {
                    const startedAt = performance.now();
                    const method = type.methods[prop as any];
                    if (!method) {
                        // Increment metrics for unknown method attempts
                        log.warn("public api: unknown method", grpc_service, prop);
                        const code = Code.Unimplemented;
                        grpcServerStarted.labels(grpc_service, "unknown", "unknown").inc();
                        grpcServerHandled.labels(grpc_service, "unknown", "unknown", Code[code]).inc();
                        grpcServerHandling.labels(grpc_service, "unknown", "unknown", Code[code]).observe(0);
                        throw new ConnectError("unimplemented", code);
                    }
                    const grpc_method = method.name;
                    let grpc_type = "unknown";
                    if (method.kind === MethodKind.Unary) {
                        grpc_type = "unary";
                    } else if (method.kind === MethodKind.ServerStreaming) {
                        grpc_type = "server_stream";
                    } else if (method.kind === MethodKind.ClientStreaming) {
                        grpc_type = "client_stream";
                    } else if (method.kind === MethodKind.BiDiStreaming) {
                        grpc_type = "bidi_stream";
                    }

                    const requestId = v4();

                    grpcServerStarted.labels(grpc_service, grpc_method, grpc_type).inc();
                    const stopTimer = grpcServerHandling.startTimer({ grpc_service, grpc_method, grpc_type });
                    const done = (err?: ConnectError) => {
                        const grpc_code = err ? Code[err.code] : "OK";
                        grpcServerHandled.labels(grpc_service, grpc_method, grpc_type, grpc_code).inc();
                        stopTimer({ grpc_code });
                        let callDuration;
                        if (callStartedAt) {
                            callDuration = performance.now() - callStartedAt;
                        }
                        withRequestContext(log.debug, log, [
                            "public api: done",
                            {
                                grpc_code,
                                duration: performance.now() - startedAt,
                                verifyDuration,
                                callDuration,
                            },
                        ]);
                    };
                    const handleError = (reason: unknown) => {
                        let err = ConnectError.from(reason, Code.Internal);
                        if (reason != err && err.code === Code.Internal) {
                            withRequestContext(log.error, log, [`public api: unexpected internal error`, reason]);
                            err = ConnectError.from(
                                `Oops! Something went wrong. Please quote the request ID ${requestId} when reaching out to Gitpod Support.`,
                                Code.Internal,
                            );
                        }
                        done(err);
                        throw err;
                    };

                    let verifyDuration: number | undefined;
                    let callStartedAt: number | undefined;
                    const context = args[1] as HandlerContext;
                    function withRequestContext<T>(
                        target: Function,
                        thisArgument: any,
                        argumentsList: ArrayLike<any>,
                    ): T {
                        return runWithContext(
                            "public-api",
                            {
                                userId: context.user?.id,
                                requestId,
                                grpc_service,
                                grpc_method,
                            },
                            () => Reflect.apply(target, thisArgument, argumentsList),
                        );
                    }

                    async function apply<T>(): Promise<T> {
                        const verifyStartedAt = performance.now();
                        const user = await self.verify(context);
                        verifyDuration = performance.now() - verifyStartedAt;
                        context.user = user;

                        callStartedAt = performance.now();
                        if (grpc_type === "unary" || grpc_type === "client_stream") {
                            return withRequestContext(target[prop as any], target, args);
                        }
                        const generator = withRequestContext(target[prop as any], target, args) as AsyncGenerator<any>;
                        return (<AsyncGenerator<any>>{
                            next: () => withRequestContext(generator.next, generator, []),
                            return: (value) => withRequestContext(generator.return, generator, [value]),
                            throw: (e) => withRequestContext(generator.throw, generator, [e]),

                            [Symbol.asyncIterator]() {
                                return this;
                            },
                        }) as any as T;
                    }
                    if (grpc_type === "unary" || grpc_type === "client_stream") {
                        return (async () => {
                            try {
                                const promise = await apply<Promise<any>>();
                                const result = await promise;
                                done();
                                return result;
                            } catch (e) {
                                handleError(e);
                            }
                        })();
                    }
                    return (async function* () {
                        try {
                            const generator = await apply<AsyncGenerator<any>>();
                            for await (const item of generator) {
                                yield item;
                            }
                            done();
                        } catch (e) {
                            handleError(e);
                        }
                    })();
                };
            },
        };
    }

    private async verify(context: HandlerContext) {
        const user = await this.sessionHandler.verify(context.requestHeader.get("cookie") || "");
        if (!user) {
            throw new ConnectError("unauthenticated", Code.Unauthenticated);
        }
        return user;
    }

    static bindAPI(bind: interfaces.Bind): void {
        bind(APIHelloService).toSelf().inSingletonScope();
        bind(APIUserService).toSelf().inSingletonScope();
        bind(APITeamsService).toSelf().inSingletonScope();
        bind(APIWorkspacesService).toSelf().inSingletonScope();
        bind(APIStatsService).toSelf().inSingletonScope();
        bind(API).toSelf().inSingletonScope();
    }
}
