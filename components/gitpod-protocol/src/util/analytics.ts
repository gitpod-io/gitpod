/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import Analytics = require("analytics-node");
import { IAnalyticsWriter, IdentifyMessage, TrackMessage, PageMessage } from "../analytics";
import { log } from './logging';


export function newAnalyticsWriterFromEnv(): IAnalyticsWriter {
    switch (process.env.GITPOD_ANALYTICS_WRITER) {
        case "segment":
            return new SegmentAnalyticsWriter(process.env.GITPOD_ANALYTICS_SEGMENT_KEY || "");
        case "log":
            return new LogAnalyticsWriter();
        default:
            return new NoAnalyticsWriter();
    }
}

class SegmentAnalyticsWriter implements IAnalyticsWriter {

    protected readonly analytics: Analytics;

    constructor(writeKey: string) {
        this.analytics = new Analytics(writeKey);
    }

        identify(msg: IdentifyMessage) {
        try {
            this.analytics.identify(msg, (err: Error) => {
                if (err) {
                    log.warn("analytics.identify failed", err);
                }
            });
        } catch (err) {
            log.warn("analytics.identify failed", err);
        }
    }

    track(msg: TrackMessage) {
        try {
            this.analytics.track(msg, (err: Error) => {
                if (err) {
                    log.warn("analytics.track failed", err);
                }
            });
        } catch (err) {
            log.warn("analytics.track failed", err);
        }
    }

    page(msg: PageMessage) {
        try{
            this.analytics.page(msg, (err: Error) => {
                if (err) {
                    log.warn("analytics.page failed", err);
                }
            });
        } catch (err) {
            log.warn("analytics.page failed", err);
        }
    }

}

class LogAnalyticsWriter implements IAnalyticsWriter {

    identify(msg: IdentifyMessage): void {
        log.debug("analytics identify", msg);
    }
    track(msg: TrackMessage): void {
        log.debug("analytics track", msg);
    }
    page(msg: PageMessage): void {
        log.debug("analytics page", msg);
    }

}

class NoAnalyticsWriter implements IAnalyticsWriter {
    identify(msg: IdentifyMessage): void {}
    track(msg: TrackMessage): void {}
    page(msg: PageMessage): void {}
}