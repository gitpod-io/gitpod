/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { inject, injectable } from "inversify";
import { log } from "@gitpod/gitpod-protocol/lib/util/logging";
import { Metrics } from "../metrics";

@injectable()
export class RedisPublisher {
    constructor(@inject(Metrics) private readonly metrics: Metrics) {}

    async publishPrebuildUpdate(): Promise<void> {
        log.debug("[redis] Publish prebuild udpate invoked.");
        this.metrics.reportUpdatePublished("prebuild");
    }

    async publishInstanceUpdate(): Promise<void> {
        log.debug("[redis] Publish instance udpate invoked.");
        this.metrics.reportUpdatePublished("workspace-instance");
    }

    async publishHeadlessUpdate(): Promise<void> {
        log.debug("[redis] Publish headless udpate invoked.");
        this.metrics.reportUpdatePublished("headless");
    }
}
