/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as grpc from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";

type GrpcMethodType = 'unary' | 'client_stream' | 'server_stream' | 'bidi_stream';
export interface IGrpcCallMetricsLabels {
	service: string,
	method: string,
	type: GrpcMethodType,
	code?: string
}

export const IClientCallMetrics = Symbol("IClientCallMetrics");

export interface IClientCallMetrics {
    called(labels: IGrpcCallMetricsLabels) : void;
}

export function getGrpcMethodType(requestStream: boolean, responseStream: boolean): GrpcMethodType {
    if (requestStream) {
        if (responseStream) {
            return 'bidi_stream';
        } else {
            return 'client_stream';
        }
    } else {
        if (responseStream) {
            return 'server_stream';
        } else {
            return 'unary';
        }
    }
}

export function createClientCallMetricsInterceptor(metrics: IClientCallMetrics): grpc.Interceptor {
    return (options, nextCall): grpc.InterceptingCall => {
        const requester = new grpc.RequesterBuilder()
            .withStart((metadata, listener, next) => {
                const newListener = new grpc.ListenerBuilder().withOnReceiveStatus((status, next) => {
                    try {
                        const methodDef = options.method_definition;
                        const method = methodDef.path.substring(methodDef.path.lastIndexOf('/') + 1);
                        const service = methodDef.path.substring(0, methodDef.path.length - method.length);
                        metrics.called({
                            service,
                            method,
                            type: getGrpcMethodType(options.method_definition.requestStream, options.method_definition.responseStream),
                            code: Status[status.code]
                        });
                    } finally {
                        next(status);
                    }
                }).build()
                next(metadata, newListener);
            }).build();
        return new grpc.InterceptingCall(nextCall(options), requester);
    };
}
