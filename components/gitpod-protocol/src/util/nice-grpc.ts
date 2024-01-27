/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { isAbortError } from "abort-controller-x";
import {
    CallOptions,
    ClientError,
    ClientMiddleware,
    ClientMiddlewareCall,
    Status,
    MethodDescriptor,
} from "nice-grpc-common";
import { GrpcMethodType, IClientCallMetrics } from "./grpc";

function getLabels(method: MethodDescriptor) {
    const callType = method.requestStream
        ? method.responseStream
            ? "bidi_stream"
            : "client_stream"
        : method.responseStream
        ? "server_stream"
        : "unary";
    const { path } = method;
    const [serviceName, methodName] = path.split("/").slice(1);

    return {
        type: callType as GrpcMethodType,
        service: serviceName,
        method: methodName,
    };
}

async function* incrementStreamMessagesCounter<T>(iterable: AsyncIterable<T>, callback: () => void): AsyncIterable<T> {
    for await (const item of iterable) {
        callback();
        yield item;
    }
}

export function prometheusClientMiddleware(metrics: IClientCallMetrics): ClientMiddleware {
    return async function* prometheusClientMiddlewareGenerator<Request, Response>(
        call: ClientMiddlewareCall<Request, Response>,
        options: CallOptions,
    ): AsyncGenerator<Response, Response | void, undefined> {
        const labels = getLabels(call.method);

        metrics.started(labels);

        const stopTimer = metrics.startHandleTimer(labels);

        let settled = false;
        let status: Status = Status.OK;

        try {
            let request;

            if (!call.requestStream) {
                request = call.request;
            } else {
                request = incrementStreamMessagesCounter(call.request, metrics.sent.bind(metrics, labels));
            }

            if (!call.responseStream) {
                const response = yield* call.next(request, options);
                settled = true;
                return response;
            } else {
                yield* incrementStreamMessagesCounter(
                    call.next(request, options),
                    metrics.received.bind(metrics, labels),
                );
                settled = true;
                return;
            }
        } catch (err) {
            settled = true;
            if (err instanceof ClientError) {
                status = err.code;
            } else if (isAbortError(err)) {
                status = Status.CANCELLED;
            } else {
                status = Status.UNKNOWN;
            }
            throw err;
        } finally {
            if (!settled) {
                status = Status.CANCELLED;
            }
            stopTimer({ grpc_code: Status[status] });
            metrics.handled({ ...labels, code: Status[status] });
        }
    };
}
