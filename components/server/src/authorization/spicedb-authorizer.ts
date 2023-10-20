/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { TrustedValue } from "@gitpod/gitpod-protocol/lib/util/scrubbing";

import { incSpiceDBRequestsCheckTotal, observeSpicedbClientLatency, spicedbClientLatency } from "../prometheus-metrics";
import { SpiceDBClientProvider } from "./spicedb";
import * as grpc from "@grpc/grpc-js";
import { isFgaChecksEnabled, isFgaWritesEnabled } from "./authorizer";
import { base64decode } from "@jmondi/oauth2-server";
import { DecodedZedToken } from "@gitpod/spicedb-impl/lib/impl/v1/impl.pb";
import { RequestContext } from "node-fetch";
import { getRequestContext } from "../util/request-context";
import { Redis } from "ioredis";
import { inject, injectable } from "inversify";
import { InstallationID } from "./definitions";

async function tryThree<T>(errMessage: string, code: (attempt: number) => Promise<T>): Promise<T> {
    let attempt = 0;
    // we do sometimes see INTERNAL errors from SpiceDB, so we retry a few times
    // last time we checked it was 15 times per day (check logs)
    while (attempt++ < 3) {
        try {
            return await code(attempt);
        } catch (err) {
            if (err.code === grpc.status.INTERNAL && attempt < 3) {
                log.warn(errMessage, err, {
                    attempt,
                });
            } else {
                log.error(errMessage, err, {
                    attempt,
                });
                // we don't try again on other errors
                throw err;
            }
        }
    }
    throw new Error("unreachable");
}

export function createSpiceDBAuthorizer(clientProvider: SpiceDBClientProvider, redis?: Redis): SpiceDBAuthorizer {
    const perRequestCache = new RequestLocalZedTokenCache();
    let cache: ZedTokenCache = perRequestCache;
    if (redis) {
        const perObjectCache = new HierachicalZedTokenCache(redis);
        cache = new PerObjectBestEffortZedTokenCache(perRequestCache, perObjectCache);
    }
    return new SpiceDBAuthorizer(clientProvider, cache);
}

interface CheckResult {
    permitted: boolean;
    checkedAt?: string;
}

interface DeletionResult {
    relationships: v1.ReadRelationshipsResponse[];
    deletedAt?: string;
}

export class SpiceDBAuthorizer {
    constructor(private readonly clientProvider: SpiceDBClientProvider, private readonly tokenCache: ZedTokenCache) {}

    private get client(): v1.ZedPromiseClientInterface {
        return this.clientProvider.getClient();
    }

    public async check(
        req: v1.CheckPermissionRequest,
        experimentsFields: { userId: string },
        parentObjectRef: v1.ObjectReference | undefined,
        forceEnablement?: boolean,
    ): Promise<boolean> {
        req.consistency = await this.consistency(parentObjectRef, req.resource);
        incSpiceDBRequestsCheckTotal(req.consistency?.requirement?.oneofKind || "undefined");

        const result = await this.checkInternal(req, experimentsFields, forceEnablement);
        if (result.checkedAt) {
            await this.tokenCache.set([req.resource, result.checkedAt]);
        }
        return result.permitted;
    }

    private async checkInternal(
        req: v1.CheckPermissionRequest,
        experimentsFields: {
            userId: string;
        },
        forceEnablement?: boolean,
    ): Promise<CheckResult> {
        if (!(await isFgaWritesEnabled(experimentsFields.userId))) {
            return { permitted: true };
        }
        const featureEnabled = !!forceEnablement || (await isFgaChecksEnabled(experimentsFields.userId));
        const result = (async () => {
            const timer = spicedbClientLatency.startTimer();
            let error: Error | undefined;
            try {
                const response = await tryThree("[spicedb] Failed to perform authorization check.", () =>
                    this.client.checkPermission(req, this.callOptions),
                );
                const permitted = response.permissionship === v1.CheckPermissionResponse_Permissionship.HAS_PERMISSION;
                if (!permitted && !featureEnabled) {
                    log.info("[spicedb] Permission denied.", {
                        response: new TrustedValue(response),
                        request: new TrustedValue(req),
                    });
                    return { permitted: true, checkedAt: response.checkedAt?.token };
                }

                return { permitted, checkedAt: response.checkedAt?.token };
            } catch (err) {
                error = err;
                log.error("[spicedb] Failed to perform authorization check.", err, {
                    request: new TrustedValue(req),
                });
                return { permitted: !featureEnabled };
            } finally {
                observeSpicedbClientLatency("check", error, timer());
            }
        })();
        // if the feature is not enabld, we don't await
        if (!featureEnabled) {
            return { permitted: true };
        }
        return result;
    }

    async writeRelationships(...updates: v1.RelationshipUpdate[]): Promise<v1.WriteRelationshipsResponse | undefined> {
        const result = await this.writeRelationshipsInternal(...updates);
        const writtenAt = result?.writtenAt?.token;
        await this.tokenCache.set(
            ...updates.map<ZedTokenCacheKV>((u) => [
                u.relationship?.resource,
                writtenAt, // Make sure that in case we don't get a writtenAt token here, we at least invalidate the cache
            ]),
        );
        return result;
    }

    private async writeRelationshipsInternal(
        ...updates: v1.RelationshipUpdate[]
    ): Promise<v1.WriteRelationshipsResponse | undefined> {
        const timer = spicedbClientLatency.startTimer();
        let error: Error | undefined;
        try {
            const response = await tryThree("[spicedb] Failed to write relationships.", () =>
                this.client.writeRelationships(
                    v1.WriteRelationshipsRequest.create({
                        updates,
                    }),
                    this.callOptions,
                ),
            );
            log.info("[spicedb] Successfully wrote relationships.", {
                response: new TrustedValue(response),
                updates: new TrustedValue(updates),
            });

            return response;
        } finally {
            observeSpicedbClientLatency("write", error, timer());
        }
    }

    async deleteRelationships(req: v1.DeleteRelationshipsRequest): Promise<v1.ReadRelationshipsResponse[]> {
        const result = await this.deleteRelationshipsInternal(req);
        log.info(`[spicedb] Deletion result`, { result });
        const deletedAt = result?.deletedAt;
        if (deletedAt) {
            await this.tokenCache.set(
                ...result.relationships.map<ZedTokenCacheKV>((r) => [r.relationship?.resource, deletedAt]),
            );
        }
        return result.relationships;
    }

    private async deleteRelationshipsInternal(req: v1.DeleteRelationshipsRequest): Promise<DeletionResult> {
        const timer = spicedbClientLatency.startTimer();
        let error: Error | undefined;
        try {
            let deletedAt: string | undefined = undefined;
            const existing = await tryThree("readRelationships before deleteRelationships failed.", () =>
                this.client.readRelationships(v1.ReadRelationshipsRequest.create(req), this.callOptions),
            );
            if (existing.length > 0) {
                const response = await tryThree("deleteRelationships failed.", () =>
                    this.client.deleteRelationships(req, this.callOptions),
                );
                deletedAt = response.deletedAt?.token;
                const after = await tryThree("readRelationships failed.", () =>
                    this.client.readRelationships(v1.ReadRelationshipsRequest.create(req), this.callOptions),
                );
                if (after.length > 0) {
                    log.error("[spicedb] Failed to delete relationships.", { existing, after, request: req });
                }
                log.info(`[spicedb] Successfully deleted ${existing.length} relationships.`, {
                    response,
                    request: req,
                    existing,
                });
            }
            return {
                relationships: existing,
                deletedAt,
            };
        } catch (err) {
            error = err;
            // While in we're running two authorization systems in parallel, we do not hard fail on writes.
            //TODO throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, "Failed to delete relationships.");
            log.error("[spicedb] Failed to delete relationships.", err, { request: new TrustedValue(req) });
            return { relationships: [] };
        } finally {
            observeSpicedbClientLatency("delete", error, timer());
        }
    }

    async readRelationships(req: v1.ReadRelationshipsRequest): Promise<v1.ReadRelationshipsResponse[]> {
        req.consistency = await this.consistency(undefined, undefined);
        incSpiceDBRequestsCheckTotal(req.consistency?.requirement?.oneofKind || "undefined");

        return tryThree("readRelationships failed.", () => this.client.readRelationships(req, this.callOptions));
    }

    /**
     * permission_service.grpc-client.d.ts has all methods overloaded with this pattern:
     *  - xyzRelationships(input: Request, metadata?: grpc.Metadata | grpc.CallOptions, options?: grpc.CallOptions): grpc.ClientReadableStream<ReadRelationshipsResponse>;
     * But the promisified client somehow does not have the same overloads. Thus we convince it here that options may be passed as 2nd argument.
     */
    private get callOptions(): grpc.Metadata {
        return (<grpc.CallOptions>{
            deadline: Date.now() + 8000,
        }) as any as grpc.Metadata;
    }

    async consistency(
        parentObjectRef: v1.ObjectReference | undefined,
        resourceRef: v1.ObjectReference | undefined,
    ): Promise<v1.Consistency> {
        function fullyConsistent() {
            return v1.Consistency.create({
                requirement: {
                    oneofKind: "fullyConsistent",
                    fullyConsistent: true,
                },
            });
        }

        const zedToken = await this.tokenCache.get(parentObjectRef, resourceRef);
        if (!zedToken) {
            return fullyConsistent();
        }
        return v1.Consistency.create({
            requirement: {
                oneofKind: "atLeastAsFresh",
                atLeastAsFresh: v1.ZedToken.create({
                    token: zedToken,
                }),
            },
        });
    }
}

type ZedTokenCacheKV = [objectRef: v1.ObjectReference | undefined, token: string | undefined];
interface ZedTokenCache {
    get(
        parentObjectRef: v1.ObjectReference | undefined,
        objectRef: v1.ObjectReference | undefined,
    ): Promise<string | undefined>;
    set(...kvs: ZedTokenCacheKV[]): Promise<boolean>;
}

export interface StoredZedToken {
    token: string;
    timestamp: number;
}
namespace StoredZedToken {
    export function create(token: string, timestamp: number): StoredZedToken {
        return { token, timestamp };
    }

    export function fromToken(token: string): StoredZedToken | undefined {
        // following https://github.com/authzed/spicedb/blob/786555c24af98abfe3f832c94dbae5ca518dcf50/pkg/zedtoken/zedtoken.go#L64-L100
        const decodedBytes = base64decode(token);
        const decodedToken = DecodedZedToken.decode(Buffer.from(decodedBytes, "utf8")).v1;
        if (!decodedToken) {
            return undefined;
        }

        // for MySQL:
        //  - https://github.com/authzed/spicedb/blob/main/internal/datastore/mysql/revisions.go#L182C1-L189C2
        //  - https://github.com/authzed/spicedb/blob/786555c24af98abfe3f832c94dbae5ca518dcf50/pkg/datastore/revision/decimal.go#L53
        const timestamp = parseInt(decodedToken.revision, 10);
        return { token, timestamp };
    }

    export function freshest(...zedTokens: StoredZedToken[]): StoredZedToken | undefined {
        return zedTokens.reduce<StoredZedToken | undefined>((a, b) => {
            if (!a || a.timestamp < b.timestamp) {
                return b;
            }
            return a;
        }, undefined);
    }

    /**
     * Returns a string representation that is _sortable_
     * @param token
     * @returns
     */
    export function toRedisValue(token: StoredZedToken): string {
        return `${token.timestamp}:${token.token}`;
    }
    export function fromRedisValue(value: string): StoredZedToken | undefined {
        const [timestampStr, token] = value.split(":");
        if (!token || !timestampStr) {
            return undefined;
        }
        let timestamp: number;
        try {
            timestamp = parseInt(timestampStr, 10);
        } catch (err) {
            log.warn("[spicedb] Failed to parse timestamp from Redis value", err, { value });
            return undefined;
        }
        return { token, timestamp };
    }
}

type ZedTokenCachingStrategy = "per-object" | "request-local";
type ContextWithZedToken = RequestContext & { strategy?: ZedTokenCachingStrategy; zedToken?: StoredZedToken };
function getContext(): ContextWithZedToken {
    return getRequestContext() as ContextWithZedToken;
}
function getStrategy(): ZedTokenCachingStrategy {
    const context = getContext();
    if (!context.strategy) {
        context.strategy = "per-object";
    }
    return context.strategy;
}
function setStrategy(strategy: ZedTokenCachingStrategy) {
    const context = getContext();
    context.strategy = strategy;
}

/**
 * This is a simple implementation of the ZedTokenCache that uses the local context to store single ZedToken per API request, which is stored in AsyncLocalStorage.
 * To make this work we make the "assumption" that ZedTokens string (meant to be opaque) represent a timestamp which we can order. This is at least true for the MySQL datastore we are using.
 */
export class RequestLocalZedTokenCache implements ZedTokenCache {
    constructor() {}

    async get(
        parentObjectRef: v1.ObjectReference | undefined,
        objectRef: v1.ObjectReference | undefined,
    ): Promise<string | undefined> {
        return getContext().zedToken?.token;
    }

    async set(...kvs: ZedTokenCacheKV[]): Promise<boolean> {
        function clearZedTokenOnContext() {
            getContext().zedToken = undefined;
        }

        const mustClearCache = kvs.some(([k, v]) => !!k && !v); // did we write a relationship without getting a writtenAt token?
        if (mustClearCache) {
            clearZedTokenOnContext();
            return false;
        }

        try {
            const allTokens = [
                ...kvs.map(([_, v]) => (!!v ? StoredZedToken.fromToken(v) : undefined)),
                getContext().zedToken,
            ].filter((v) => !!v) as StoredZedToken[];
            const freshest = StoredZedToken.freshest(...allTokens);
            if (freshest) {
                getContext().zedToken = freshest;
                return true;
            }
        } catch (err) {
            log.warn("[spicedb] Failed to set ZedToken on context", err);
            clearZedTokenOnContext();
        }
        return false;
    }
}

/**
 * HierachicalZedTokenCache guarantees caching with full consistency in a restricted set of scenarios, and if we provide resourceOrgId on
 * a get() request.
 * It does that by understanding the hierachy of our resource/relationship model and caching ZedTokens in redis:
 *  1. When adding or removing a relationship (or a resource, we don't distinguish), we::
 *   - update the resource itself in redis
 *  2. When reading a resource, we always read all tokens for the full hierachy, and:
 *   - require the child tokens to not be fresher than the parent tokens (to make sure we propagate membership changes)
 *   - if the leaf token is the freshest: use that to perform the actual query
 *   Reasoning:
 *    - we only use the cache for the cases we are really sure we can guarantee strong consistency without much hassle
 *    - if we have to "deoptimize" that's not that big of a problem in a READ-heavy environment (with very flat hierachies) like ours,
 *      because after that singley fullyConsistent check is done we will we ready to serve all subsequent requests for that resource
 * Known limitations:
 *   - This model relies on the fact that we store all updates to redis. If that is not guaranteed, e.g. in case redis is not available for some time and afterwards comes up with an outdated state, we might end up with inconsistent results.
 *   - We need a `setIfGreater` operation in redis to make sure we don't override ourselves. There are plugins for redis, we just need to install them (redis-if: https://github.com/nodeca/redis-if)
 *   - On gitpod.io, the "installation#member" relation is set very often, which in the current implementation would effectively disable the cache.
 *    - We could think about ways to avoid this
 */
@injectable()
export class HierachicalZedTokenCache implements ZedTokenCache {
    constructor(
        @inject(Redis)
        private readonly redis: Redis,
    ) {}

    async get(
        parentObjectRef: v1.ObjectReference | undefined,
        objectRef: v1.ObjectReference | undefined,
    ): Promise<string | undefined> {
        if (!parentObjectRef || !objectRef) {
            return undefined;
        }
        try {
            const keys = this.keys(parentObjectRef, objectRef);
            const values = await this.redis.mget(keys);

            let freshestToken: StoredZedToken | undefined = undefined;
            for (const v of values) {
                // iterate over all values, from root to leaf (keys are ordered that way)
                if (!v) {
                    // We are looking for the most recent value in the hierarchy...
                    // TODO(gpl) Do we need to invalidate here as well? I don't think so.
                    continue;
                }
                const parsed = StoredZedToken.fromRedisValue(v);
                if (!parsed) {
                    // ... but if set an explicit
                    return undefined;
                }
                if (freshestToken && freshestToken.timestamp > parsed.timestamp) {
                    // a parent is fresher than a child, so we need to stop here
                    // This way we guarantee that we "invalidate" child tokens on parent writes.
                    // TODO(gpl) This currently breaks on "installation.addUser", which is triggered very often :-/
                    return undefined;
                }
                freshestToken = parsed;
            }
            return freshestToken?.token;
        } catch (err) {
            log.warn("[spicedb] HierachicalZedTokenCache: Failed to get token", err);
            return undefined;
        }
    }

    async set(...kvs: ZedTokenCacheKV[]): Promise<boolean> {
        let failed = false;

        try {
            let multi = this.redis.multi();
            for (const [k, v] of kvs) {
                if (!k) {
                    // This should never happen, but let's see
                    log.warn("[spicedb] HierachicalZedTokenCache: missing object reference", {
                        k: new TrustedValue(k),
                        v,
                    });
                    failed = true;
                    continue;
                }

                if (v) {
                    const token = StoredZedToken.fromToken(v);
                    if (token) {
                        // TODO(gpl) should be an atomic "setGreatest"
                        multi = multi.set(this.key(k), StoredZedToken.toRedisValue(token));
                        continue;
                    }
                }

                // should never happen, let's make it visible it does nonetheless
                log.warn("[spicedb] HierachicalZedTokenCache: missing token, should clear the cache", {
                    k: new TrustedValue(k),
                    v,
                });
            }

            await multi.exec();
            return !failed;
        } catch (err) {
            log.warn("[spicedb] HierachicalZedTokenCache: Failed to set token", err);
        }
        return false;
    }

    private key(objectRef: v1.ObjectReference): string {
        const PREFIX = "zedtoken";
        return `${PREFIX}:${objectRef.objectType}:${objectRef.objectId}`;
    }

    /**
     * Returns all cache keys from the given object up to the root (installation), ordered from root to leaf.
     * @param parentObjectRef
     * @param objectRef
     * @returns
     */
    private keys(parentObjectRef: v1.ObjectReference | undefined, objectRef: v1.ObjectReference): string[] {
        switch (objectRef.objectType) {
            case "user":
            case "workspace":
            case "project":
                if (
                    !parentObjectRef ||
                    (parentObjectRef.objectType !== "organization" && parentObjectRef.objectType !== "installation")
                ) {
                    throw new Error("ZedToken: invalid key error");
                }

                return [...this.keys(undefined, parentObjectRef), this.key(objectRef)];
            case "organization":
                // because we know there's only ever one installation for one org, we can take a shortcut here
                return [
                    ...this.keys(
                        undefined,
                        v1.ObjectReference.create({
                            objectId: InstallationID,
                            objectType: "installation",
                        }),
                    ),
                    this.key(objectRef),
                ];
            case "installation":
                return [this.key(objectRef)];
        }
        throw new Error("ZedToken.keys unreachable");
    }
}

/**
 * PerObjectBestEffortZedTokenCache decides on a per request basis what caching strategy to use. It tries to start out with "per-object". But if that does not work for whatever reason, it falls back to the request-local cache. This decision is sticky to the request to maintain our consistency guarantees.
 *
 * This helps us to use HierachicalZedTokenCache in selected cases, without major changes to the interal API or DB access patterns.
 */
@injectable()
export class PerObjectBestEffortZedTokenCache implements ZedTokenCache {
    constructor(
        @inject(RequestLocalZedTokenCache) private readonly requestLocalCache: RequestLocalZedTokenCache,
        @inject(HierachicalZedTokenCache) private readonly perObjectCache: HierachicalZedTokenCache,
    ) {}

    async get(
        parentObjectRef: v1.ObjectReference | undefined,
        objectRef: v1.ObjectReference | undefined,
    ): Promise<string | undefined> {
        const strategy = getStrategy();
        if (strategy === "per-object") {
            const result = await this.perObjectCache.get(parentObjectRef, objectRef);
            if (result) {
                return result;
            }
            // else: fall back to request-local
        }
        setStrategy("request-local"); // make our decision sticky for this request

        return this.requestLocalCache.get(parentObjectRef, objectRef);
    }

    async set(...kvs: ZedTokenCacheKV[]): Promise<boolean> {
        const strategy = getStrategy();

        // Always try to keep the per-object cache up-to-date, even if we are not using it for this request.
        const result = this.perObjectCache.set(...kvs).catch(log.error);
        if (strategy === "per-object" && (await result) === true) {
            return true;
        }
        // on failure: fall back to request-local

        setStrategy("request-local"); // make our decision sticky for this request
        // Not filling the request-local cache before switching away from "per-object" ensures that start with a clean slate, which is needed to maintain our consistency guarantees.
        return await this.requestLocalCache.set(...kvs);
    }
}
