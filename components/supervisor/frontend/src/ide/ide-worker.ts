/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/**
 * Installs the proxy (shared) worker serving from the same origin to fetch content from the blobserve origin.
 */
export function install(): void {
  if (window.Worker) {
    const Worker = window.Worker;
    window.Worker = <any>function (scriptUrl: string | URL, options?: WorkerOptions) {
      return new Worker(proxyUrl(scriptUrl), options);
    };
  }
  if (window.SharedWorker) {
    const SharedWorker = window.SharedWorker;
    window.SharedWorker = <any>function (scriptUrl: string, options?: string | SharedWorkerOptions) {
      return new SharedWorker(proxyUrl(scriptUrl), options);
    };
  }
}

function proxyUrl(scriptUrl: string | URL | TrustedScriptURL): string {
  scriptUrl =
    scriptUrl instanceof URL
      ? scriptUrl
      : new URL(typeof scriptUrl === 'string' ? scriptUrl : scriptUrl.toString(), document.baseURI);
  if (scriptUrl.origin !== location.origin || (scriptUrl.protocol !== 'http:' && scriptUrl.protocol !== 'https:')) {
    return scriptUrl.toString();
  }
  return new URL(
    '_supervisor/frontend/worker-proxy.js#' + encodeURI(scriptUrl.toString()),
    document.baseURI,
  ).toString();
}
