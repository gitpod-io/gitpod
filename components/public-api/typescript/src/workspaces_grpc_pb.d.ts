/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// package: gitpod.v1
// file: workspaces.proto

/* tslint:disable */
/* eslint-disable */

import * as grpc from "@grpc/grpc-js";
import * as workspaces_pb from "./workspaces_pb";

interface IWorkspacesService extends grpc.ServiceDefinition<grpc.UntypedServiceImplementation> {
}


export const WorkspacesService: IWorkspacesService;

export interface IWorkspacesServer extends grpc.UntypedServiceImplementation {
}

export interface IWorkspacesClient {
}

export class WorkspacesClient extends grpc.Client implements IWorkspacesClient {
    constructor(address: string, credentials: grpc.ChannelCredentials, options?: Partial<grpc.ClientOptions>);
}
