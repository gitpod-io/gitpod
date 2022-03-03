/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as grpc from '@grpc/grpc-js';
import { WorkspaceManagerClient } from './core_grpc_pb';
import { DescribeWorkspaceRequest, DescribeWorkspaceResponse } from './core_pb';

var client = new WorkspaceManagerClient('localhost:8080', grpc.credentials.createInsecure());
new Promise<DescribeWorkspaceResponse>((resolve, reject) => {
    const req = new DescribeWorkspaceRequest();
    req.setId('foobar');
    client.describeWorkspace(req, (err, resp) => {
        if (!!err) {
            reject(err);
        } else {
            resolve(resp);
        }
    });
}).then(console.log);
