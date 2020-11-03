/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
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
    self.importScripts = function (scriptUrl) {
        return originalImportScripts(new URL(scriptUrl, baseURI).toString());
    }
    originalImportScripts(baseURI);
})();
