/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as grpc from '@grpc/grpc-js';
import { Status } from '@grpc/grpc-js/build/src/constants';

type GrpcMethodType = 'unary' | 'client_stream' | 'server_stream' | 'bidi_stream';
export interface IGrpcCallMetricsLabels {
    service: string;
    method: string;
    type: GrpcMethodType;
}

export interface IGrpcCallMetricsLabelsWithCode extends IGrpcCallMetricsLabels {
    code: string;
}

export const IClientCallMetrics = Symbol('IClientCallMetrics');

export interface IClientCallMetrics {
    handled(labels: IGrpcCallMetricsLabelsWithCode): void;
    received(labels: IGrpcCallMetricsLabels): void;
    sent(labels: IGrpcCallMetricsLabels): void;
    started(labels: IGrpcCallMetricsLabels): void;
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
        const methodDef = options.method_definition;
        const method = methodDef.path.substring(methodDef.path.lastIndexOf('/') + 1);
        const service = methodDef.path.substring(1, methodDef.path.length - method.length - 1);
        const labels = {
            service,
            method,
            type: getGrpcMethodType(options.method_definition.requestStream, options.method_definition.responseStream),
        };
        const requester = new grpc.RequesterBuilder()
            .withStart((metadata, listener, next) => {
                const newListener = new grpc.ListenerBuilder()
                    .withOnReceiveStatus((status, next) => {
                        try {
                            metrics.handled({
                                ...labels,
                                code: Status[status.code],
                            });
                        } finally {
                            next(status);
                        }
                    })
                    .withOnReceiveMessage((message, next) => {
                        try {
                            metrics.received(labels);
                        } finally {
                            next(message);
                        }
                    })
                    .build();
                try {
                    metrics.started(labels);
                } finally {
                    next(metadata, newListener);
                }
            })
            .withSendMessage((message, next) => {
                try {
                    metrics.sent(labels);
                } finally {
                    next(message);
                }
            })
            .build();
        return new grpc.InterceptingCall(nextCall(options), requester);
    };
}
