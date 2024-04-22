/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import { inject, injectable } from "inversify";
import express from "express";
import {
    IAnalyticsWriter,
    IdentifyMessage,
    RemoteIdentifyMessage,
    RemotePageMessage,
    RemoteTrackMessage,
} from "@gitpod/gitpod-protocol/lib/analytics";
import { createCookielessId, maskIp } from "./analytics";
import { ClientHeaderFields, toClientHeaderFields } from "./express-util";
import { Config } from "./config";
import { RateLimited } from "./api/rate-limited";
import { RateLimitter } from "./rate-limitter";
import { RateLimiterRes } from "rate-limiter-flexible";

@injectable()
export class AnalyticsController {
    constructor(
        @inject(IAnalyticsWriter) private readonly analytics: IAnalyticsWriter,
        @inject(Config) private readonly config: Config,
        @inject(RateLimitter) private readonly rateLimitter: RateLimitter,
    ) {}

    get router(): express.Router {
        const router = express.Router();
        router.post("/trackEvent", async (req, res) => {
            try {
                if (await this.rateLimitted(req.user?.id, "trackEvent", res)) {
                    return;
                }
                const clientHeaderFields = toClientHeaderFields(req);
                const event = req.body as RemoteTrackMessage;
                this.trackEvent(req.user?.id, event, clientHeaderFields);
                res.sendStatus(200);
            } catch (e) {
                console.error("failed to track event", e);
                res.sendStatus(500);
            }
        });
        router.post("/trackLocation", async (req, res) => {
            try {
                if (await this.rateLimitted(req.user?.id, "trackLocation", res)) {
                    return;
                }
                const clientHeaderFields = toClientHeaderFields(req);
                const event = req.body as RemotePageMessage;
                this.trackLocation(req.user?.id, event, clientHeaderFields);
                res.sendStatus(200);
            } catch (e) {
                console.error("failed to track location", e);
                res.sendStatus(500);
            }
        });
        router.post("/identifyUser", async (req, res) => {
            try {
                if (!req.user?.id) {
                    res.sendStatus(401);
                    return;
                }
                if (await this.rateLimitted(req.user?.id, "identifyUser", res)) {
                    return;
                }
                const clientHeaderFields = toClientHeaderFields(req);
                const event = req.body as RemoteIdentifyMessage;
                this.identifyUser(req.user.id, event, clientHeaderFields);
                res.sendStatus(200);
            } catch (e) {
                console.error("failed to identify user", e);
                res.sendStatus(500);
            }
        });
        return router;
    }

    public trackEvent(
        userId: string | undefined,
        event: RemoteTrackMessage,
        clientHeaderFields: ClientHeaderFields,
    ): void {
        // Beware: DO NOT just event... the message, but consume it individually as the message is coming from
        //         the wire and we have no idea what's in it. Even passing the context and properties directly
        //         is questionable. Considering we're handing down the msg and do not know how the analytics library
        //         handles potentially broken or malicious input, we better err on the side of caution.

        const { ip, userAgent } = clientHeaderFields;
        const anonymousId = event.anonymousId || createCookielessId(ip, userAgent);
        const msg = {
            event: event.event,
            messageId: event.messageId,
            context: event.context,
            properties: event.properties,
        };

        //only track if at least one identifier is known
        if (userId) {
            this.analytics.track({
                userId: userId,
                anonymousId: anonymousId,
                ...msg,
            });
        } else if (anonymousId) {
            this.analytics.track({
                anonymousId: anonymousId as string | number,
                ...msg,
            });
        }
    }

    public trackLocation(
        userId: string | undefined,
        event: RemotePageMessage,
        clientHeaderFields: ClientHeaderFields,
    ): void {
        const { ip, userAgent } = clientHeaderFields;
        const anonymousId = event.anonymousId || createCookielessId(ip, userAgent);
        const msg = {
            messageId: event.messageId,
            context: {},
            properties: event.properties,
        };

        //only page if at least one identifier is known
        if (userId) {
            msg.context = {
                ip: maskIp(ip),
                userAgent: userAgent,
            };
            this.analytics.page({
                userId: userId,
                anonymousId: anonymousId,
                ...msg,
            });
        } else if (anonymousId) {
            this.analytics.page({
                anonymousId: anonymousId as string | number,
                ...msg,
            });
        }
    }

    public identifyUser(userId: string, event: RemoteIdentifyMessage, clientHeaderFields: ClientHeaderFields): void {
        // traceAPIParams(ctx, { event }); tracing analytics does not make much sense

        //Identify calls collect user informmation. If the user is unknown, we don't make a call (privacy preservation)
        const { ip, userAgent } = clientHeaderFields;
        const identifyMessage: IdentifyMessage = {
            userId,
            anonymousId: event.anonymousId || createCookielessId(ip, userAgent),
            traits: event.traits,
            context: event.context,
        };
        this.analytics.identify(identifyMessage);
    }

    private async rateLimitted(userId: string | undefined, key: string, res: express.Response): Promise<boolean> {
        const options = this.config.rateLimits?.[key] || RateLimited.defaultOptions;
        try {
            await this.rateLimitter.consume(`${userId}_${key}`, options);
            return false;
        } catch (e) {
            if (e instanceof RateLimiterRes) {
                res.setHeader("Retry-After", e.msBeforeNext / 1000);
                if (options.points !== undefined) {
                    res.setHeader("X-RateLimit-Limit", options.points);
                }
                res.setHeader("X-RateLimit-Remaining", e.remainingPoints);
                res.setHeader("X-RateLimit-Reset", new Date(Date.now() + e.msBeforeNext).toISOString());
                res.sendStatus(429);
                return true;
            }
            throw e;
        }
    }
}
