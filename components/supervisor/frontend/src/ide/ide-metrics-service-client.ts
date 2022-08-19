/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { serverUrl } from '../shared/urls';

export enum MetricsName {
    SupervisorFrontendClientTotal = "gitpod_supervisor_frontend_client_total",
    SupervisorFrontendErrorTotal = "gitpod_supervisor_frontend_error_total"
}

const MetricsUrl = serverUrl.asIDEMetrics().toString();

interface AddCounterParam {
    value?: number;
    labels?: Record<string, string>;
}

export class IDEMetricsServiceClient {

    static async addCounter(metricsName: MetricsName, labels?: Record<string, string>, value?: number) : Promise<boolean> {
        const url = `${MetricsUrl}/metrics/counter/add/${metricsName}`
        const params: AddCounterParam = { value, labels }
        try {
            const response = await fetch(url, {
                method: "POST",
                body: JSON.stringify(params),
                credentials: "omit",
            })
            if (!response.ok) {
                const data = await response.json() // { code: number; message: string; }
                console.error(`Cannot report metrics with addCounter: ${response.status} ${response.statusText}`, data)
                return false
            }
            return true
        } catch (err) {
            console.error("Cannot report metrics with addCounter, error:", err)
            return false
        }
    }
}
