/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { GitpodHostUrl } from "@gitpod/gitpod-protocol/lib/util/gitpod-host-url";

/**
 * Installs the proxy (shared) worker serving from the same origin to fetch content from the blobserve origin.
 */
export function install(): void {
    if (window.Worker) {
        const Worker = window.Worker;
        window.Worker = <any>function (stringUrl: string | URL, options?: WorkerOptions) {
            if (!new GitpodHostUrl(stringUrl).blobServe) {
                return new Worker(stringUrl, options);
            }
            return new Worker(proxyUrl(stringUrl), options);
        };
    }
    if (window.SharedWorker) {
        const SharedWorker = window.SharedWorker;
        window.SharedWorker = <any>function (stringUrl: string, options?: string | SharedWorkerOptions) {
            if (!new GitpodHostUrl(stringUrl).blobServe) {
                return new SharedWorker(stringUrl, options);
            }
            return new SharedWorker(proxyUrl(stringUrl), options);
        };
    }
}

function proxyUrl(stringUrl: string | URL): string {
    // TODO(ak) importScripts is not going to work for module workers: https://web.dev/module-workers/
    const js = `importScripts('${stringUrl}');`;
    return `data:text/javascript;charset=utf-8,${encodeURIComponent(js)}`
}
