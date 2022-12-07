/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export * from "../lib/idemetrics_pb";
export * from "../lib/idemetrics_pb_service";

import { MetricsServiceClient } from "../lib/idemetrics_pb_service";
import { AddCounterRequest, ObserveHistogramRequest } from "../lib/idemetrics_pb";
export interface IDEMetric {
    kind: "counter" | "histogram";
    name: string;
    labels: Record<string, string>;
    value?: number;
}

export function sendMetrics(client: MetricsServiceClient, metrics: IDEMetric[]): Promise<PromiseSettledResult<void>[]> {
    return Promise.allSettled(
        metrics.map(async (metric) => {
            if (metric.kind === "counter") {
                const req = new AddCounterRequest();
                req.setName(metric.name);
                for (const key in metric.labels) {
                    req.getLabelsMap().set(key, metric.labels[key]);
                }
                if (metric.value !== undefined) {
                    req.setValue(metric.value);
                }
                await new Promise((resolve, reject) =>
                    client.addCounter(req, (e) => {
                        if (e) {
                            reject(e);
                        } else {
                            resolve(undefined);
                        }
                    }),
                );
            } else {
                const req = new ObserveHistogramRequest();
                req.setName(metric.name);
                for (const key in metric.labels) {
                    req.getLabelsMap().set(key, metric.labels[key]);
                }
                if (metric.value !== undefined) {
                    req.setValue(metric.value);
                }
                await new Promise((resolve, reject) =>
                    client.observeHistogram(req, (e) => {
                        if (e) {
                            reject(e);
                        } else {
                            resolve(undefined);
                        }
                    }),
                );
            }
        }),
    );
}
