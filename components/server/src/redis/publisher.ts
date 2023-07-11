/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import {
    PrebuildUpdatesChannel,
    RedisPrebuildUpdate,
    RedisWorkspaceInstanceUpdate,
    WorkspaceInstanceUpdatesChannel,
} from "@gitpod/gitpod-protocol";
import { Redis } from "ioredis";
import { reportUpdatePublished } from "../prometheus-metrics";

@injectable()
export class RedisPublisher {
    constructor(@inject(Redis) private readonly client: Redis) {}

    async publishPrebuildUpdate(update: RedisPrebuildUpdate): Promise<void> {
        log.debug("[redis] Publish prebuild udpate invoked.");

        let err: Error | undefined;
        try {
            const serialized = JSON.stringify(update);
            await this.client.publish(PrebuildUpdatesChannel, serialized);
            log.debug("[redis] Succesfully published prebuild update.", update);
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
            await this.client.publish(WorkspaceInstanceUpdatesChannel, serialized);
            log.debug("[redis] Succesfully published instance update.", update);
        } catch (e) {
            err = e;
            log.error("[redis] Failed to publish instance update.", e, update);
        } finally {
            reportUpdatePublished("workspace-instance", err);
        }
    }

    async publishHeadlessUpdate(): Promise<void> {
        log.debug("[redis] Publish headless udpate invoked.");
        reportUpdatePublished("headless");
    }
}
