/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { MethodKind, ServiceType } from "@bufbuild/protobuf";
import { Code, ConnectError, ConnectRouter, HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { expressConnectMiddleware } from "@connectrpc/connect-express";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { PublicAPIConverter } from "@gitpod/public-api-common/lib/public-api-converter";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { HelloService } from "@gitpod/public-api/lib/gitpod/experimental/v1/dummy_connect";
import { StatsService } from "@gitpod/public-api/lib/gitpod/experimental/v1/stats_connect";
import { TeamsService as TeamsServiceDefinition } from "@gitpod/public-api/lib/gitpod/experimental/v1/teams_connect";
import { OrganizationService } from "@gitpod/public-api/lib/gitpod/v1/organization_connect";
import { WorkspaceService } from "@gitpod/public-api/lib/gitpod/v1/workspace_connect";
import { AuditLogService as AuditLogServiceFromAPI } from "@gitpod/public-api/lib/gitpod/v1/auditlogs_connect";
import { UserService } from "@gitpod/public-api/lib/gitpod/v1/user_connect";
import { ConfigurationService } from "@gitpod/public-api/lib/gitpod/v1/configuration_connect";
import { AuthProviderService } from "@gitpod/public-api/lib/gitpod/v1/authprovider_connect";
import { EnvironmentVariableService } from "@gitpod/public-api/lib/gitpod/v1/envvar_connect";
import express from "express";
import * as http from "http";
import { decorate, inject, injectable, interfaces } from "inversify";
import { AddressInfo } from "net";
import { performance } from "perf_hooks";
import { RateLimiterRes } from "rate-limiter-flexible";
import { v4 } from "uuid";
import { Config } from "../config";
import { grpcServerHandled, grpcServerHandling, grpcServerStarted } from "../prometheus-metrics";
import { SessionHandler } from "../session-handler";
import {
    runWithSubjectId,
    runWithRequestContext,
    wrapAsyncGenerator,
    RequestContextSeed,
} from "../util/request-context";
import { HelloServiceAPI } from "./hello-service-api";
import { OrganizationServiceAPI } from "./organization-service-api";
import { RateLimited } from "./rate-limited";
import { APIStatsService as StatsServiceAPI } from "./stats";
import { APITeamsService as TeamsServiceAPI } from "./teams";
import { WorkspaceServiceAPI } from "./workspace-service-api";
import { ConfigurationServiceAPI } from "./configuration-service-api";
import { AuthProviderServiceAPI } from "./auth-provider-service-api";
import { EnvironmentVariableServiceAPI } from "./envvar-service-api";
import { SSHServiceAPI } from "./ssh-service-api";
import { Unauthenticated } from "./unauthenticated";
import { SubjectId } from "../auth/subject-id";
import { BearerAuth } from "../auth/bearer-authenticator";
import { ScmServiceAPI } from "./scm-service-api";
import { SCMService } from "@gitpod/public-api/lib/gitpod/v1/scm_connect";
import { SSHService } from "@gitpod/public-api/lib/gitpod/v1/ssh_connect";
import { PrebuildServiceAPI } from "./prebuild-service-api";
import { PrebuildService } from "@gitpod/public-api/lib/gitpod/v1/prebuild_connect";
import { VerificationServiceAPI } from "./verification-service-api";
import { VerificationService } from "@gitpod/public-api/lib/gitpod/v1/verification_connect";
import { UserServiceAPI } from "./user-service-api";
import { UserService as UserServiceInternal } from "../user/user-service";
import { InstallationServiceAPI } from "./installation-service-api";
import { InstallationService } from "@gitpod/public-api/lib/gitpod/v1/installation_connect";
import { RateLimitter } from "../rate-limitter";
import { TokenServiceAPI } from "./token-service-api";
import { TokenService } from "@gitpod/public-api/lib/gitpod/v1/token_connect";
import { AuditLogService } from "../audit/AuditLogService";
import { AuditLogServiceAPI } from "./audit-log-service-api";

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
    @inject(TokenServiceAPI) private readonly tokenServiceAPI: TokenServiceAPI;
    @inject(ConfigurationServiceAPI) private readonly configurationServiceApi: ConfigurationServiceAPI;
    @inject(AuthProviderServiceAPI) private readonly authProviderServiceApi: AuthProviderServiceAPI;
    @inject(EnvironmentVariableServiceAPI) private readonly envvarServiceApi: EnvironmentVariableServiceAPI;
    @inject(ScmServiceAPI) private readonly scmServiceAPI: ScmServiceAPI;
    @inject(SSHServiceAPI) private readonly sshServiceApi: SSHServiceAPI;
    @inject(StatsServiceAPI) private readonly tatsServiceApi: StatsServiceAPI;
    @inject(HelloServiceAPI) private readonly helloServiceApi: HelloServiceAPI;
    @inject(AuditLogServiceAPI) private readonly auditLogServiceApi: AuditLogServiceAPI;
    @inject(SessionHandler) private readonly sessionHandler: SessionHandler;
    @inject(PublicAPIConverter) private readonly apiConverter: PublicAPIConverter;
    @inject(Config) private readonly config: Config;
    @inject(UserServiceInternal) private readonly userServiceInternal: UserServiceInternal;
    @inject(BearerAuth) private readonly bearerAuthenticator: BearerAuth;
    @inject(PrebuildServiceAPI) private readonly prebuildServiceApi: PrebuildServiceAPI;
    @inject(VerificationServiceAPI) private readonly verificationServiceApi: VerificationServiceAPI;
    @inject(InstallationServiceAPI) private readonly installationServiceApi: InstallationServiceAPI;
    @inject(RateLimitter) private readonly rateLimitter: RateLimitter;
    @inject(AuditLogService) private readonly auditLogService: AuditLogService;

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
                        service(UserService, this.userServiceApi),
                        service(WorkspaceService, this.workspaceServiceApi),
                        service(OrganizationService, this.organizationServiceApi),
                        service(TokenService, this.tokenServiceAPI),
                        service(ConfigurationService, this.configurationServiceApi),
                        service(AuthProviderService, this.authProviderServiceApi),
                        service(EnvironmentVariableService, this.envvarServiceApi),
                        service(SCMService, this.scmServiceAPI),
                        service(SSHService, this.sshServiceApi),
                        service(PrebuildService, this.prebuildServiceApi),
                        service(VerificationService, this.verificationServiceApi),
                        service(InstallationService, this.installationServiceApi),
                        service(AuditLogServiceFromAPI, this.auditLogServiceApi),
                    ]) {
                        router.service(type, new Proxy(impl, this.interceptService(type)));
                    }
                },
            }),
        );
        // TODO(ak) cover unhandled cases
    }

    /**
     * intercept handles cross-cutting concerns for all calls:
     * - authentication
     * - server-side observability
     * - logging context
     * - rate limitting
     * TODO(ak):
     * - tracing
     * - cancellation
     */
    private interceptService<T extends ServiceType>(type: T): ProxyHandler<ServiceImpl<T>> {
        const grpc_service = type.typeName;
        const self = this;
        return {
            get(target, prop) {
                return (...args: any[]) => {
                    const connectContext = args[1] as HandlerContext;
                    const requestContext: RequestContextSeed = {
                        requestId: v4(),
                        requestKind: "public-api",
                        requestMethod: `${grpc_service}/${prop as string}`,
                        startTime: performance.now(),
                        signal: connectContext.signal,
                        headers: connectContext.requestHeader,
                    };
                    connectContext.responseHeader.set("x-request-id", requestContext.requestId!);

                    const withRequestContext = <T>(fn: () => T): T => runWithRequestContext(requestContext, fn);

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

                    const isException = (err: ConnectError) =>
                        err.code === Code.Internal || err.code === Code.Unknown || err.code === Code.DataLoss;

                    grpcServerStarted.labels(grpc_service, grpc_method, grpc_type).inc();
                    const stopTimer = grpcServerHandling.startTimer({ grpc_service, grpc_method, grpc_type });
                    const done = (err?: ConnectError) => {
                        const grpc_code = err ? Code[err.code] : "OK";
                        grpcServerHandled.labels(grpc_service, grpc_method, grpc_type, grpc_code).inc();
                        stopTimer({ grpc_code });
                        log.debug("public api: done", { grpc_code });
                        // If the request took too long, log it
                        const ctxTime = requestContext.startTime ? performance.now() - requestContext.startTime : 0;
                        if (grpc_type === "unary" && ctxTime > 5000) {
                            log.warn("public api: request took too long", { ctxTime, grpc_code });
                        }
                    };
                    const handleError = (reason: unknown) => {
                        const err = self.apiConverter.toError(reason);

                        if (
                            err.code === Code.Internal &&
                            err.message.includes("Cannot call write after a stream was destroyed")
                        ) {
                            // Compare https://linear.app/gitpod/issue/ENT-232 and https://github.com/gitpod-io/gitpod/pull/19827
                            // Connect seems to try to write an error response to a closed stream in some cases(*), resulting in this error.
                            // We don't want it to pollute our metrics, so we ignore it.
                            //
                            // (*) Hypothesis: This seems to happen when the client cancels a stream and abortSignal is triggered, and we throw a "cancelled" error.
                            log.debug("connect wrote to a closed stream, ignoring.");
                            done();
                            return;
                        }

                        if (isException(err)) {
                            log.error("public api exception reason:", reason);
                        }
                        done(err);
                        throw err;
                    };

                    const rateLimit = async (subjectId: string) => {
                        const key = `${grpc_service}/${grpc_method}`;
                        const options = self.config.rateLimits?.[key] || RateLimited.getOptions(target, prop);
                        try {
                            await self.rateLimitter.consume(`${subjectId}_${key}`, options);
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

                    // actually call the RPC handler
                    const auth = async () => {
                        // Authenticate
                        const subjectId = await self.verify(connectContext);
                        const isAuthenticated = !!subjectId;
                        const requiresAuthentication = !Unauthenticated.get(target, prop);
                        if (!isAuthenticated && requiresAuthentication) {
                            throw new ConnectError("unauthenticated", Code.Unauthenticated);
                        }

                        if (isAuthenticated) {
                            await rateLimit(subjectId.toString());
                            await self.ensureFgaMigration(subjectId);
                        }
                        // TODO(at) if unauthenticated, we still need to apply enforece a rate limit

                        return subjectId;
                    };

                    const apply = async <T>(): Promise<T> => {
                        return Reflect.apply(target[prop as any], target, args);
                    };
                    if (grpc_type === "unary" || grpc_type === "client_stream") {
                        return withRequestContext(async () => {
                            let subjectId: SubjectId | undefined = undefined;
                            try {
                                subjectId = await auth();
                            } catch (e) {
                                handleError(e);
                            }

                            return runWithSubjectId(subjectId, async () => {
                                try {
                                    const promise = await apply<Promise<any>>();
                                    const result = await promise;
                                    if (subjectId) {
                                        self.auditLogService.asyncRecordAuditLog(
                                            subjectId!.userId()!,
                                            requestContext.requestMethod,
                                            [args[0]],
                                        );
                                    }
                                    done();
                                    return result;
                                } catch (e) {
                                    handleError(e);
                                }
                            });
                        });
                    }

                    // Because we can't await before returning that generator, we await inside the generator, and create child contexts with that SubjectId
                    return wrapAsyncGenerator(
                        (async function* () {
                            let subjectId: SubjectId | undefined = undefined;
                            try {
                                subjectId = await auth();
                            } catch (e) {
                                handleError(e);
                            }

                            // We can't wrap the generator in runWithSubjectId, so we have to "unroll" it here.
                            try {
                                const generator = await runWithSubjectId(subjectId, () => apply<AsyncGenerator<any>>());
                                while (true) {
                                    const { value, done } = await runWithSubjectId(subjectId, () => generator.next());
                                    if (done) {
                                        break;
                                    }
                                    yield value;
                                }
                                done();
                            } catch (e) {
                                runWithSubjectId(subjectId, () => handleError(e));
                            }
                        })(),
                        withRequestContext,
                    );
                };
            },
        };
    }

    private async verify(context: HandlerContext): Promise<SubjectId | undefined> {
        // 1. Try Bearer token first
        try {
            const subjectId = await this.bearerAuthenticator.tryAuthFromHeaders(context.requestHeader);
            if (subjectId) {
                return subjectId;
            }
            // fall-through to session JWT
        } catch (err) {
            log.warn("error authenticating subject by Bearer token", err);
        }

        // 2. Try for session JWT in the "cookie" header
        const cookieHeader = (context.requestHeader.get("cookie") || "") as string;
        try {
            const claims = await this.sessionHandler.verifyJWTCookie(cookieHeader);
            const userId = claims?.sub;
            return !!userId ? SubjectId.fromUserId(userId) : undefined;
        } catch (err) {
            log.warn("Failed to authenticate user with JWT Session", err);
            return undefined;
        }
    }

    private async ensureFgaMigration(subjectId: SubjectId): Promise<void> {
        if (subjectId.kind === "user") {
            const userId = subjectId.userId()!;
            try {
                await this.userServiceInternal.findUserById(userId, userId);
            } catch (e) {
                if (e instanceof ApplicationError && e.code === ErrorCodes.NOT_FOUND) {
                    throw new ConnectError("unauthorized", Code.PermissionDenied);
                }
                throw e;
            }
        }
    }

    static bindAPI(bind: interfaces.Bind): void {
        bind(PublicAPIConverter).toSelf().inSingletonScope();
        bind(HelloServiceAPI).toSelf().inSingletonScope();
        bind(UserServiceAPI).toSelf().inSingletonScope();
        bind(TeamsServiceAPI).toSelf().inSingletonScope();
        bind(WorkspaceServiceAPI).toSelf().inSingletonScope();
        bind(OrganizationServiceAPI).toSelf().inSingletonScope();
        bind(TokenServiceAPI).toSelf().inSingletonScope();
        bind(ConfigurationServiceAPI).toSelf().inSingletonScope();
        bind(AuthProviderServiceAPI).toSelf().inSingletonScope();
        bind(AuditLogServiceAPI).toSelf().inSingletonScope();
        bind(EnvironmentVariableServiceAPI).toSelf().inSingletonScope();
        bind(ScmServiceAPI).toSelf().inSingletonScope();
        bind(SSHServiceAPI).toSelf().inSingletonScope();
        bind(StatsServiceAPI).toSelf().inSingletonScope();
        bind(PrebuildServiceAPI).toSelf().inSingletonScope();
        bind(VerificationServiceAPI).toSelf().inSingletonScope();
        bind(InstallationServiceAPI).toSelf().inSingletonScope();
        bind(API).toSelf().inSingletonScope();
    }
}
