/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// @ts-check

/**
 * The proxy (shared) worker serving from the workspace origin to fetch content from the blobserve origin.
 */

// TODO(ak) importScripts is not going to work for module workers: https://web.dev/module-workers/
(function () {
    var originalImportScripts = self.importScripts;
    // hash contains the original worker URL to be used as a base URI to resolve script URLs
    var baseURI = decodeURI(location.hash.substr(1));

    self.importScripts = function (...scriptUrls) {
        return originalImportScripts(...scriptUrls.map((scriptUrl) => new URL(scriptUrl, baseURI).toString()));
    };

    var originalFetch = self.fetch;
    self.fetch = function (input, init) {
        if (typeof input === 'string') {
            return originalFetch(new URL(input, baseURI).toString(), init);
        }
        return originalFetch(input, init);
    };

    var originalRequest = self.Request;
    function RequestProxy(input, init) {
        if (typeof input === 'string') {
            return new originalRequest(new URL(input, baseURI).toString(), init);
        }
        return new originalRequest(input, init);
    }
    RequestProxy.prototype = Object.create(originalRequest);
    self.Request = RequestProxy;

    originalImportScripts(baseURI);
})();
