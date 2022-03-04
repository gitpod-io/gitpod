/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the Gitpod Enterprise Source Code License,
 * See License.enterprise.txt in the project root folder.
 */

import { injectable, inject } from 'inversify';
import { Application as App } from 'express';
import * as http from 'http';

import { log } from '@gitpod/gitpod-protocol/lib/util/logging';

import { EndpointController } from './chargebee/endpoint-controller';
import { GithubEndpointController } from './github/endpoint-controller';
import { GithubSubscriptionReconciler } from './github/subscription-reconciler';
import { Config } from './config';
import { AddressInfo } from 'net';

@injectable()
export class Server {
    @inject(EndpointController) protected readonly chargebeeController: EndpointController;
    @inject(GithubEndpointController) protected readonly githubController: GithubEndpointController;
    @inject(GithubSubscriptionReconciler) protected readonly githubSubscriptionReconciler: GithubSubscriptionReconciler;
    @inject(Config) protected readonly config: Config;

    protected app?: App;
    protected httpServer?: http.Server;

    async init(app: App): Promise<void> {
        app.use(this.chargebeeController.apiRouter);

        if (this.config.githubAppEnabled) {
            this.githubController.register("/github", app);
            this.githubSubscriptionReconciler.start();
            log.info("GitHub integration is ENABLED");
        } else {
            log.info("GitHub integration is disabled");
        }

        this.app = app;
    }

    async start(port: number): Promise<void> {
        if (!this.app) {
            throw new Error('Server not initialized!');
        }

        const app = this.app;
        await new Promise<void>((resolve, reject) => {
            const httpServer = app.listen(port, () => {
                log.info(`Server listening on port: ${(<AddressInfo> httpServer.address()).port}`);
                resolve();
            }).on('error', reject);
            this.httpServer = httpServer;
        });
    }

    async stop(): Promise<void> {
        const httpServer = this.httpServer;
        if (httpServer) {
            this.httpServer = undefined;
            await new Promise ((resolve) => httpServer.close(resolve));
        }
    }
}
