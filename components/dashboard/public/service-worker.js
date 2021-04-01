/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

self.addEventListener('fetch', () => {
    // pass through just to enable PWA, see https://web.dev/install-criteria/#criteria
    // we already agressively cache everything by leveraging browser caching
});