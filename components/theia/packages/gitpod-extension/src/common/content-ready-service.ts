/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { inject, injectable, postConstruct } from "inversify";
import { JsonRpcServer } from "@theia/core";
import { Deferred } from "@theia/core/lib/common/promise-util";

export interface ContentReadyServiceClient {
    onContentReady(): Promise<void>;
}

export const ContentReadyServiceServer = Symbol('ContentReadyServiceServer');
export interface ContentReadyServiceServer extends JsonRpcServer<ContentReadyServiceClient> {
    markContentReady(): void;
    isContentReady(): boolean;
    disposeClient(client: ContentReadyServiceClient): void;
}

@injectable()
export class ContentReadyService {

    @inject(ContentReadyServiceServer) private readonly server: ContentReadyServiceServer;

    protected contentReady = new Deferred<void>();

    get readyPromise() {
        return this.contentReady.promise;
    }

    @postConstruct()
    init(): void {
        const onContentReady: () => Promise<void> = () => {
            this.contentReady.resolve();
            return this.contentReady.promise;
        };
        this.server.setClient({ onContentReady });
        if (this.server.isContentReady()) {
            // content was ready before we registered the listener
            onContentReady();
        }
    }
}

export namespace ContentReadyService {
    export const SERVICE_PATH = '/services/content-ready-service';
}
