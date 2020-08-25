/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require('reflect-metadata');
// Use asyncIterators with es2015
if (typeof (Symbol as any).asyncIterator === 'undefined') {
    (Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol('asyncIterator');
}

import * as express from 'express';
import { Container } from 'inversify';
import { Server } from "./server"
import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { TracingManager } from '@gitpod/gitpod-protocol/lib/util/tracing';
if (process.env.NODE_ENV === 'development') {
    require('longjohn');
}

log.enableJSONLogging('server', process.env.VERSION);

export async function start(container: Container) {
    const tracing = container.get(TracingManager);
    tracing.setup("server", {
        perOpSampling: {
            "createWorkspace": true,
            "startWorksace": true,
            "sendHeartbeat": false,
        }
    });

    const server = container.get(Server);
    const port = 3000;
    const app = express();

    await server.init(app);
    await server.start(port);

    process.on('SIGTERM', async () => {
        log.info('SIGTERM received, stopping');
        await server.stop();
    });
}
