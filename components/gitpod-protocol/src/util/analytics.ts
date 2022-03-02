/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import Analytics = require("analytics-node");
import axios from "axios";
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
        const axiosInstance = axios.create()
        axiosInstance.interceptors.response.use((response) => {
            log.info(`Analytics response: config ${JSON.stringify(response.config)} status ${response.status} header ${JSON.stringify(response.headers)} data ${JSON.stringify(response.data)}`)
            return response;
        }, function (error) {
            return Promise.reject(error);
        });

        this.analytics = new Analytics(writeKey, {
            // @ts-ignore
            axiosInstance,
        });
    }

        identify(msg: IdentifyMessage) {
        try {
            this.analytics.identify({
                ...msg,
                integrations: {
                    "All": true,
                    "Mixpanel": !!msg.userId
                }
            }, (err: Error) => {
                if (err) {
                    log.warn("analytics.identify failed", err);
                }
            });
        } catch (err) {
            log.warn("analytics.identify failed", err);
        }
    }

    track(msg: TrackMessage) {
        if (msg.event === "supervisor_readiness") {
            log.info(`segment track supervisor_readiness with kind: ${msg.properties?.kind} ${msg.properties.workspaceId}`)
        }
        try {
            this.analytics.track({
                ...msg,
                integrations: {
                    "All": true,
                    "Mixpanel": !!msg.userId
                }
                // @ts-ignore
            }, (err: Error, data: any) => {
                if (msg.event === "supervisor_readiness") {
                  log.warn(`segment track supervisor_readiness done with kind: ${msg.properties?.kind} ${msg.properties.workspaceId} data: ${JSON.stringify(data)} ============`, err)
                }
                if (err) {
                    log.warn("analytics.track failed", err);
                }
            });
        } catch (err) {
            log.warn("analytics.track failed", err);
            if (msg.event === "supervisor_readiness") {
                log.warn(`segment[2] track supervisor_readiness failed with kind: ${msg.properties?.kind}`, err)
            }
        }
    }

    page(msg: PageMessage) {
        try{
            this.analytics.page({
                ...msg,
                integrations: {
                    "All": true,
                    "Mixpanel": !!msg.userId
                }
            }, (err: Error) => {
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