/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";
import { CheckResult, DeletionResult, SpiceDBAuthorizer, SpiceDBAuthorizerImpl } from "./spicedb-authorizer";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { inject, injectable } from "inversify";
import { clearZedTokenOnContext, getZedTokenFromContext, setZedTokenToContext } from "../util/log-context";
import { base64decode } from "@jmondi/oauth2-server";

export type ZedTokenCacheKV = [objectRef: v1.ObjectReference | undefined, token: string | undefined];
export const ZedTokenCache = Symbol("ZedTokenCache");
export interface ZedTokenCache {
    get(objectRef: v1.ObjectReference): Promise<string | undefined>;
    set(...kvs: ZedTokenCacheKV[]): Promise<void>;
    consistency(resourceRef: v1.ObjectReference | undefined): Promise<v1.Consistency>;
}

/**
 * Works as a caching decorator for SpiceDBAuthorizerImpl. Delegates the actual caching strategy to ZedTokenCache.
 */
@injectable()
export class CachingSpiceDBAuthorizer implements SpiceDBAuthorizer {
    constructor(
        @inject(SpiceDBAuthorizerImpl)
        private readonly impl: SpiceDBAuthorizerImpl,
        @inject(ZedTokenCache)
        private readonly tokenCache: ZedTokenCache,
    ) {}

    async check(
        req: v1.CheckPermissionRequest,
        experimentsFields: { userId: string },
        forceEnablement?: boolean | undefined,
    ): Promise<CheckResult> {
        req.consistency = await this.tokenCache.consistency(req.resource);
        const result = await this.impl.check(req, experimentsFields, forceEnablement);
        if (result.checkedAt) {
            await this.tokenCache.set([req.resource, result.checkedAt]);
        }
        return result;
    }

    async writeRelationships(...updates: v1.RelationshipUpdate[]): Promise<v1.WriteRelationshipsResponse | undefined> {
        const result = await this.impl.writeRelationships(...updates);
        const writtenAt = result?.writtenAt?.token;
        await this.tokenCache.set(
            ...updates.map<ZedTokenCacheKV>((u) => [
                u.relationship?.resource,
                writtenAt, // Make sure that in case we don't get a writtenAt token here, we at least invalidate the cache
            ]),
        );
        return result;
    }

    async deleteRelationships(req: v1.DeleteRelationshipsRequest): Promise<DeletionResult> {
        const result = await this.impl.deleteRelationships(req);
        log.info(`[spicedb] Deletion result`, { result });
        const deletedAt = result?.deletedAt;
        if (deletedAt) {
            await this.tokenCache.set(
                ...result.relationships.map<ZedTokenCacheKV>((r) => [r.relationship?.resource, deletedAt]),
            );
        }
        return result;
    }

    async readRelationships(req: v1.ReadRelationshipsRequest): Promise<v1.ReadRelationshipsResponse[]> {
        // pass through with given consistency/caching for now
        return this.impl.readRelationships(req);
    }
}

/**
 * This is a simple implementation of the ZedTokenCache that uses the local context to store single ZedToken per API request, which is stored in AsyncLocalStorage.
 * To make this work we make the "assumption" that ZedTokens string (meant to be opaque) represent a timestamp which we can order. This is at least true for the MySQL datastore we are using.
 */
@injectable()
export class RequestLocalZedTokenCache implements ZedTokenCache {
    constructor() {}

    async get(objectRef: v1.ObjectReference): Promise<string | undefined> {
        return getZedTokenFromContext()?.token;
    }

    async set(...kvs: ZedTokenCacheKV[]) {
        const mustClearCache = kvs.some(([k, v]) => !!k && !v); // did we write a relationship without getting a writtenAt token?
        if (mustClearCache) {
            clearZedTokenOnContext();
            return;
        }

        try {
            const allTokens = [
                ...kvs.map(([_, v]) => (!!v ? StoredZedToken.fromToken(v) : undefined)),
                getZedTokenFromContext(),
            ].filter((v) => !!v) as StoredZedToken[];
            const freshest = this.freshest(...allTokens);
            if (freshest) {
                setZedTokenToContext(freshest);
            }
        } catch (err) {
            log.warn("[spicedb] Failed to set ZedToken on context", err);
            clearZedTokenOnContext();
        }
    }

    async consistency(resourceRef: v1.ObjectReference | undefined): Promise<v1.Consistency> {
        function fullyConsistent() {
            return v1.Consistency.create({
                requirement: {
                    oneofKind: "fullyConsistent",
                    fullyConsistent: true,
                },
            });
        }
        if (!resourceRef) {
            return fullyConsistent();
        }

        const zedToken = await this.get(resourceRef);
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

    protected freshest(...zedTokens: StoredZedToken[]): StoredZedToken | undefined {
        return zedTokens.reduce<StoredZedToken | undefined>((prev, curr) => {
            if (!prev || prev.timestamp < curr.timestamp) {
                return curr;
            }
            return curr;
        }, undefined);
    }
}

export interface StoredZedToken {
    token: string;
    timestamp: number;
}
namespace StoredZedToken {
    export function create(token: string, timestamp: number): StoredZedToken {
        return { token, timestamp };
    }
    export function fromToken(zedToken: string): StoredZedToken {
        const token = base64decode(zedToken);
        const timestamp = parseInt(token, 10);
        return { token, timestamp };
    }
}
