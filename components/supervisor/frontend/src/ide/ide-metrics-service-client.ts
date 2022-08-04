/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { MetricsServicePromiseClient } from '@gitpod/ide-metrics-api-grpcweb/lib/idemetrics_grpc_web_pb'
import { AddCounterRequest, AddCounterResponse } from '@gitpod/ide-metrics-api-grpcweb/lib/idemetrics_pb'
import { serverUrl } from '../shared/urls';

const client = new MetricsServicePromiseClient(serverUrl.asIDEMetrics().toString())

export enum MetricsName {
    SupervisorFrontendClientTotal = "gitpod_supervisor_frontend_client_total",
    SupervisorFrontendErrorTotal = "gitpod_supervisor_frontend_error_total"
}

export class IDEMetricsServiceClient {

    static async addCounter(metricsName: string, labels?: Map<string, string>, value?: number) : Promise<AddCounterResponse> {
        const req = new AddCounterRequest()
        req.setName(metricsName)
        if (value) {
            req.setValue(value)
        }
        if (labels) {
            const m = req.getLabelsMap()
            for (const [name, value] of labels) {
                m.set(name, value)
            }
        }
        return client.addCounter(req)
    }
}
