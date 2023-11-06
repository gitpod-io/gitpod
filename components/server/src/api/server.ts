/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MethodKind, ServiceType } from "@bufbuild/protobuf";
import { Code, ConnectError, ConnectRouter, HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { expressConnectMiddleware } from "@connectrpc/connect-express";
import { User } from "@gitpod/gitpod-protocol";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { HelloService } from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_connect";
import { StatsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/stats_connect";
import { TeamsService as TeamsServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connect";
import { UserService as UserServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/user_connect";
import { OrganizationService } from "@gitpod/public-api/lib/gitpod/v1/organization_connect";
import { WorkspaceService } from "@gitpod/public-api/lib/gitpod/v1/workspace_connect";
import { ConfigurationService } from "@gitpod/public-api/lib/gitpod/v1/configuration_connect";
import express from "express";
import * as http from "http";
import { decorate, inject, injectable, interfaces } from "inversify";
import { Redis } from "ioredis";
import { AddressInfo } from "net";
import { performance } from "perf_hooks";
import { IRateLimiterOptions, RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import { v4 } from "uuid";
import { isFgaChecksEnabled } from "../authorization/authorizer";
import { Config } from "../config";
import { grpcServerHandled, grpcServerHandling, grpcServerStarted } from "../prometheus-metrics";
import { SessionHandler } from "../session-handler";
import { UserService } from "../user/user-service";
import { LogContextOptions, runWithLogContext } from "../util/log-context";
import { wrapAsyncGenerator } from "../util/request-context";
import { HelloServiceAPI } from "./hello-service-api";
import { OrganizationServiceAPI } from "./organization-service-api";
import { RateLimited } from "./rate-limited";
import { APIStatsService as StatsServiceAPI } from "./stats";
import { APITeamsService as TeamsServiceAPI } from "./teams";
import { APIUserService as UserServiceAPI } from "./user";
import { WorkspaceServiceAPI } from "./workspace-service-api";
import { ConfigurationServiceAPI } from "./configuration-service-api";

decorate(injectable(), PublicAPIConverter);

function service<T extends ServiceType>(type: T, impl: ServiceImpl<T>): [T, ServiceImpl<T>] {
    return [type, impl];
}

@injectable()
export class API {
    @inject(UserServiceAPI) private readonly userServiceApi: UserServiceAPI;
    @inject(TeamsServiceAPI) private readonly teamServiceApi: TeamsServiceAPI;
    @inject(WorkspaceServiceAPI) private readonly workspaceServiceApi: WorkspaceServiceAPI;
    @inject(OrganizationServiceAPI) private readonly organizationServiceApi: OrganizationServiceAPI;
    @inject(ConfigurationServiceAPI) private readonly configurationServiceApi: ConfigurationServiceAPI;
    @inject(StatsServiceAPI) private readonly tatsServiceApi: StatsServiceAPI;
    @inject(HelloServiceAPI) private readonly helloServiceApi: HelloServiceAPI;
    @inject(SessionHandler) private readonly sessionHandler: SessionHandler;
    @inject(PublicAPIConverter) private readonly apiConverter: PublicAPIConverter;
    @inject(Redis) private readonly redis: Redis;
    @inject(Config) private readonly config: Config;
    @inject(UserService) private readonly userService: UserService;

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
                        service(WorkspaceService, this.workspaceServiceApi),
                        service(OrganizationService, this.organizationServiceApi),
                        service(ConfigurationService, this.configurationServiceApi),
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

                    const rateLimit = async (subjectId: string) => {
                        const key = `${grpc_service}/${grpc_method}`;
                        const options = self.config.rateLimits?.[key] || RateLimited.getOptions(target, prop);
                        try {
                            await self.getRateLimitter(options).consume(`${subjectId}_${key}`);
                        } catch (e) {
                            if (e instanceof RateLimiterRes) {
                                throw new ConnectError("rate limit exceeded", Code.ResourceExhausted, {
                                    // http compatibility, can be respected by gRPC clients as well
                                    // instead of doing an ad-hoc retry, the client can wait for the given amount of seconds
                                    "Retry-After": e.msBeforeNext / 1000,
                                    "X-RateLimit-Limit": options.points,
                                    "X-RateLimit-Remaining": e.remainingPoints,
                                    "X-RateLimit-Reset": new Date(Date.now() + e.msBeforeNext),
                                });
                            }
                            throw e;
                        }
                    };

                    const apply = async <T>(): Promise<T> => {
                        const subjectId = await self.verify(context);
                        await rateLimit(subjectId);
                        context.user = await self.ensureFgaMigration(subjectId);

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

    private async verify(context: HandlerContext): Promise<string> {
        const cookieHeader = (context.requestHeader.get("cookie") || "") as string;
        const claims = await this.sessionHandler.verifyJWTCookie(cookieHeader);
        const subjectId = claims?.sub;
        if (!subjectId) {
            throw new ConnectError("unauthenticated", Code.Unauthenticated);
        }
        return subjectId;
    }

    private async ensureFgaMigration(userId: string): Promise<User> {
        const fgaChecksEnabled = await isFgaChecksEnabled(userId);
        if (!fgaChecksEnabled) {
            throw new ConnectError("unauthorized", Code.PermissionDenied);
        }
        try {
            return await this.userService.findUserById(userId, userId);
        } catch (e) {
            if (e instanceof ApplicationError && e.code === ErrorCodes.NOT_FOUND) {
                throw new ConnectError("unauthorized", Code.PermissionDenied);
            }
            throw e;
        }
    }

    private readonly rateLimiters = new Map<string, RateLimiterRedis>();
    private getRateLimitter(options: IRateLimiterOptions): RateLimiterRedis {
        const sortedKeys = Object.keys(options).sort();
        const sortedObject: { [key: string]: any } = {};
        for (const key of sortedKeys) {
            sortedObject[key] = options[key as keyof IRateLimiterOptions];
        }
        const key = JSON.stringify(sortedObject);

        let rateLimiter = this.rateLimiters.get(key);
        if (!rateLimiter) {
            rateLimiter = new RateLimiterRedis({
                storeClient: this.redis,
                ...options,
                insuranceLimiter: new RateLimiterMemory(options),
            });
            this.rateLimiters.set(key, rateLimiter);
        }
        return rateLimiter;
    }

    static bindAPI(bind: interfaces.Bind): void {
        bind(PublicAPIConverter).toSelf().inSingletonScope();
        bind(HelloServiceAPI).toSelf().inSingletonScope();
        bind(UserServiceAPI).toSelf().inSingletonScope();
        bind(TeamsServiceAPI).toSelf().inSingletonScope();
        bind(WorkspaceServiceAPI).toSelf().inSingletonScope();
        bind(OrganizationServiceAPI).toSelf().inSingletonScope();
        bind(StatsServiceAPI).toSelf().inSingletonScope();
        bind(API).toSelf().inSingletonScope();
    }
}
