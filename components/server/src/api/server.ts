/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { Code, ConnectError, ConnectRouter, HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { expressConnectMiddleware } from "@connectrpc/connect-express";
import { MethodKind, ServiceType } from "@bufbuild/protobuf";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { HelloService } from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_connect";
import { StatsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/stats_connect";
import { TeamsService as TeamsServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connect";
import { UserService as UserServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/user_connect";
import { WorkspaceService } from "@gitpod/public-api/lib/gitpod/experimental/v2/workspace_connect";
import express from "express";
import * as http from "http";
import { decorate, inject, injectable, interfaces } from "inversify";
import { AddressInfo } from "net";
import { performance } from "perf_hooks";
import { v4 } from "uuid";
import { isFgaChecksEnabled } from "../authorization/authorizer";
import { grpcServerHandled, grpcServerHandling, grpcServerStarted } from "../prometheus-metrics";
import { SessionHandler } from "../session-handler";
import { LogContextOptions, runWithLogContext } from "../util/log-context";
import { wrapAsyncGenerator } from "../util/request-context";
import { HelloServiceAPI as HelloServiceAPI } from "./hello-service-api";
import { APIStatsService as StatsServiceAPI } from "./stats";
import { APITeamsService as TeamsServiceAPI } from "./teams";
import { APIUserService as UserServiceAPI } from "./user";
import { WorkspaceServiceAPI } from "./workspace-service-api";

decorate(injectable(), PublicAPIConverter);

function service<T extends ServiceType>(type: T, impl: ServiceImpl<T>): [T, ServiceImpl<T>] {
    return [type, impl];
}

@injectable()
export class API {
    @inject(UserServiceAPI) private readonly userServiceApi: UserServiceAPI;
    @inject(TeamsServiceAPI) private readonly teamServiceApi: TeamsServiceAPI;
    @inject(WorkspaceServiceAPI) private readonly workspacesServiceApi: WorkspaceServiceAPI;
    @inject(StatsServiceAPI) private readonly tatsServiceApi: StatsServiceAPI;
    @inject(HelloServiceAPI) private readonly helloServiceApi: HelloServiceAPI;
    @inject(SessionHandler) private readonly sessionHandler: SessionHandler;
    @inject(PublicAPIConverter) private readonly apiConverter: PublicAPIConverter;

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
                    router.service(UserServiceDefinition, this.userServiceApi);
                    router.service(TeamsServiceDefinition, this.teamServiceApi);
                    router.service(StatsService, this.tatsServiceApi);
                },
            }),
        );
    }

    private register(app: express.Application) {
        app.use(
            expressConnectMiddleware({
                routes: (router: ConnectRouter) => {
                    for (const [type, impl] of [
                        service(HelloService, this.helloServiceApi),
                        service(WorkspaceService, this.workspacesServiceApi),
                    ]) {
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
     * - cancellation
     */
    private interceptService<T extends ServiceType>(type: T): ProxyHandler<ServiceImpl<T>> {
        const grpc_service = type.typeName;
        const self = this;
        return {
            get(target, prop) {
                return (...args: any[]) => {
                    const logContext: LogContextOptions & {
                        requestId?: string;
                        contextTimeMs: number;
                        grpc_service: string;
                        grpc_method: string;
                    } = {
                        contextTimeMs: performance.now(),
                        grpc_service,
                        grpc_method: prop as string,
                    };
                    const withRequestContext = <T>(fn: () => T): T => runWithLogContext("public-api", logContext, fn);

                    const method = type.methods[prop as string];
                    if (!method) {
                        // Increment metrics for unknown method attempts
                        withRequestContext(() => log.warn("public api: unknown method"));
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

                    logContext.requestId = v4();

                    grpcServerStarted.labels(grpc_service, grpc_method, grpc_type).inc();
                    const stopTimer = grpcServerHandling.startTimer({ grpc_service, grpc_method, grpc_type });
                    const done = (err?: ConnectError) => {
                        const grpc_code = err ? Code[err.code] : "OK";
                        grpcServerHandled.labels(grpc_service, grpc_method, grpc_type, grpc_code).inc();
                        stopTimer({ grpc_code });
                        log.debug("public api: done", { grpc_code });
                    };
                    const handleError = (reason: unknown) => {
                        let err = self.apiConverter.toError(reason);
                        if (reason != err && err.code === Code.Internal) {
                            log.error("public api: unexpected internal error", reason);
                            err = new ConnectError(
                                `Oops! Something went wrong. Please quote the request ID ${logContext.requestId} when reaching out to Gitpod Support.`,
                                Code.Internal,
                                // pass metadata to preserve the application error
                                err.metadata,
                            );
                        }
                        done(err);
                        throw err;
                    };

                    const context = args[1] as HandlerContext;

                    const apply = async <T>(): Promise<T> => {
                        const user = await self.verify(context);
                        context.user = user;

                        return Reflect.apply(target[prop as any], target, args);
                    };
                    if (grpc_type === "unary" || grpc_type === "client_stream") {
                        return withRequestContext(async () => {
                            try {
                                const promise = await apply<Promise<any>>();
                                const result = await promise;
                                done();
                                return result;
                            } catch (e) {
                                handleError(e);
                            }
                        });
                    }
                    return wrapAsyncGenerator(
                        (async function* () {
                            try {
                                const generator = await apply<AsyncGenerator<any>>();
                                for await (const item of generator) {
                                    yield item;
                                }
                                done();
                            } catch (e) {
                                handleError(e);
                            }
                        })(),
                        withRequestContext,
                    );
                };
            },
        };
    }

    private async verify(context: HandlerContext) {
        const user = await this.sessionHandler.verify(context.requestHeader.get("cookie") || "");
        if (!user) {
            throw new ConnectError("unauthenticated", Code.Unauthenticated);
        }
        const fgaChecksEnabled = await isFgaChecksEnabled(user.id);
        if (!fgaChecksEnabled) {
            throw new ConnectError("unauthorized", Code.PermissionDenied);
        }
        return user;
    }

    static bindAPI(bind: interfaces.Bind): void {
        bind(PublicAPIConverter).toSelf().inSingletonScope();
        bind(HelloServiceAPI).toSelf().inSingletonScope();
        bind(UserServiceAPI).toSelf().inSingletonScope();
        bind(TeamsServiceAPI).toSelf().inSingletonScope();
        bind(WorkspaceServiceAPI).toSelf().inSingletonScope();
        bind(StatsServiceAPI).toSelf().inSingletonScope();
        bind(API).toSelf().inSingletonScope();
    }
}
