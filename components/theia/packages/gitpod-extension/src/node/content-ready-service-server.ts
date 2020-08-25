/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { ContentReadyServiceServer, ContentReadyServiceClient } from "../common/content-ready-service";
import { injectable } from "inversify";

@injectable()
export class ContentReadyServiceServerImpl implements ContentReadyServiceServer {
    protected contentReady: boolean = false;
    protected clients: ContentReadyServiceClient[] = [];

    setClient(client: ContentReadyServiceClient): void {
        this.clients.push(client);

        if (this.contentReady) {
            client.onContentReady();
        }
    }

    disposeClient(client: ContentReadyServiceClient): void {
        const idx = this.clients.indexOf(client);
        if (idx > -1) {
            this.clients.splice(idx, 1);
        }

        if (this.clients.length == 0) {
            this.dispose();
        }
    }

    dispose(): void {

    }

    markContentReady(): void {
        this.contentReady = true;
        this.clients.forEach(c => c.onContentReady());
    }

    isContentReady(): boolean {
        return this.contentReady;
    }

}