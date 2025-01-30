/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
import "reflect-metadata";

import { inject, injectable } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    HeadlessUpdatesChannel,
    PrebuildUpdatesChannel,
    RedisHeadlessUpdate,
    RedisPrebuildUpdate,
    RedisWorkspaceInstanceUpdate,
    WorkspaceInstanceUpdatesChannel,
} from "@gitpod/gitpod-protocol";
import { Redis } from "ioredis";
import { reportUpdatePublished } from "./metrics";

@injectable()
export class RedisPublisher {
    constructor(@inject(Redis) private readonly redis: Redis) {}

    async publishPrebuildUpdate(update: RedisPrebuildUpdate): Promise<void> {
        log.debug("[redis] Publish prebuild update invoked.");

        let err: Error | undefined;
        try {
            const serialized = JSON.stringify(update);
            await this.redis.publish(PrebuildUpdatesChannel, serialized);
            log.debug("[redis] Successfully published prebuild update.", update);
        } catch (e) {
            err = e;
            log.error("[redis] Failed to publish prebuild update.", e, update);
        } finally {
            reportUpdatePublished("prebuild", err);
        }
    }

    async publishInstanceUpdate(update: RedisWorkspaceInstanceUpdate): Promise<void> {
        let err: Error | undefined;
        try {
            const serialized = JSON.stringify(update);
            await this.redis.publish(WorkspaceInstanceUpdatesChannel, serialized);
            log.debug("[redis] Successfully published instance update.", update);
        } catch (e) {
            err = e;
            log.error("[redis] Failed to publish instance update.", e, update);
        } finally {
            reportUpdatePublished("workspace-instance", err);
        }
    }

    async publishHeadlessUpdate(update: RedisHeadlessUpdate): Promise<void> {
        log.debug("[redis] Publish headless update invoked.");

        let err: Error | undefined;
        try {
            const serialized = JSON.stringify(update);
            await this.redis.publish(HeadlessUpdatesChannel, serialized);
            log.debug("[redis] Successfully published headless update.", update);
        } catch (e) {
            err = e;
            log.error("[redis] Failed to publish headless update.", e, update);
        } finally {
            reportUpdatePublished("headless", err);
        }
    }
}
