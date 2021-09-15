/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { injectable } from 'inversify';
import * as prometheusClient from 'prom-client';

type GrpcMethodType = 'unary' | 'client_stream' | 'server_stream' | 'bidi_stream';
export interface IGrpcCallMetricsLabels {
	service: string,
	method: string,
	type: GrpcMethodType,
	code?: string
}

export interface IClientCallMetrics {
    called(labels: IGrpcCallMetricsLabels) : void;
}

@injectable()
export class PrometheusClientCallMetrics implements IClientCallMetrics {

	readonly counter: prometheusClient.Counter;

	constructor() {
		this.counter = new prometheusClient.Counter({
			name: 'grpc_client_calls_total',
			help: 'Total amount of gRPC client calls',
			labelNames: ['grpc_service', 'grpc_method', 'grpc_type', 'grpc_code'],
			registers: [prometheusClient.register]
		});
	}

	called(labels: IGrpcCallMetricsLabels): void {
		if (labels.code) {
			this.counter.inc({
				grpc_service: labels.service,
				grpc_method: labels.method,
				grpc_type: labels.type,
				grpc_code: labels.code,
			});
		} else {
			this.counter.inc({
				grpc_service: labels.service,
				grpc_method: labels.method,
				grpc_type: labels.type
			});
		}
	}
}
