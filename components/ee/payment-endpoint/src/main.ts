/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

require('reflect-metadata');

import * as express from 'express';
import { Container } from 'inversify';
import { Server } from "./server";
import { productionContainerModule } from './container-module';

import { log } from '@gitpod/gitpod-protocol/lib/util/logging';
import { dbContainerModule } from '@gitpod/gitpod-db/lib/container-module';

log.enableJSONLogging('payment-endpoint', undefined);

const init = async () => {
    const container = new Container();
    container.load(productionContainerModule);
    container.load(dbContainerModule);

    const server = container.get(Server);
    const app = express();

    await server.init(app);
    return { server, port: 3002 };
};

const start = async (initResult: { server: Server, port: number }) => {
    await initResult.server.start(initResult.port);

    process.on('unhandledRejection', (error:any) => {
        log.error('Received an unhandledRejection event. Exiting.', error);
        process.exit(1);
    });
    process.on('SIGTERM', async () => {
        log.info('SIGTERM received, stopping');
        await initResult.server.stop();
    });
};

init()
    .then(start)
    .catch(err => {
        log.error("Error during startup or operation. Exiting.", err);
        process.exit(1);
    });
