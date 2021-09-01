/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

 export const defaultGRPCOptions = {
    "grpc.keepalive_timeout_ms": 1000,
    "grpc.keepalive_time_ms": 5000,
    "grpc.http2.min_time_between_pings_ms": 1000,
    "grpc.keepalive_permit_without_calls": 1,
    "grpc-node.max_session_memory": 50,
    "grpc.max_reconnect_backoff_ms": 5000,
    "grpc.max_receive_message_length": 1024 * 1024 * 16,
};
