/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as grpc from "@grpc/grpc-js";
import { Status } from "@grpc/grpc-js/build/src/constants";

export const defaultGRPCOptions = {
    "grpc.keepalive_timeout_ms": 10000,
    "grpc.keepalive_time_ms": 60000,
    "grpc.http2.min_time_between_pings_ms": 10000,
    "grpc.keepalive_permit_without_calls": 1,
    "grpc-node.max_session_memory": 50,
    "grpc.max_reconnect_backoff_ms": 5000,
    "grpc.max_receive_message_length": 1024 * 1024 * 16,
    // default is 30s, which is too long for us during rollouts (where service DNS entries are updated)
    "grpc.dns_min_time_between_resolutions_ms": 2000,
};

export type GrpcMethodType = "unary" | "client_stream" | "server_stream" | "bidi_stream";

export interface IGrpcCallMetricsLabels {
    service: string;
    method: string;
    type: GrpcMethodType;
}

export interface IGrpcCallMetricsLabelsWithCode extends IGrpcCallMetricsLabels {
    code: string;
}

export const IClientCallMetrics = Symbol("IClientCallMetrics");

export interface IClientCallMetrics {
    started(labels: IGrpcCallMetricsLabels): void;
    sent(labels: IGrpcCallMetricsLabels): void;
    received(labels: IGrpcCallMetricsLabels): void;
    handled(labels: IGrpcCallMetricsLabelsWithCode): void;
    startHandleTimer(
        labels: IGrpcCallMetricsLabels,
    ): (labels?: Partial<Record<string, string | number>> | undefined) => number;
}

export function getGrpcMethodType(requestStream: boolean, responseStream: boolean): GrpcMethodType {
    if (requestStream) {
        if (responseStream) {
            return "bidi_stream";
        } else {
            return "client_stream";
        }
    } else {
        if (responseStream) {
            return "server_stream";
        } else {
            return "unary";
        }
    }
}

export function createClientCallMetricsInterceptor(metrics: IClientCallMetrics): grpc.Interceptor {
    return (options, nextCall): grpc.InterceptingCall => {
        const methodDef = options.method_definition;
        const method = methodDef.path.substring(methodDef.path.lastIndexOf("/") + 1);
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

export function isGrpcError(err: any): err is grpc.StatusObject {
    return err.code && err.details;
}
