/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// **IMPORTANT** it should not have any imports

if (window.top !== window) {
    const workspaceOrigin = new URL(window.location.href).origin;
    window.top.postMessage({ type: 'relocate', url: window.location.href }, workspaceOrigin)
} else {
    // dynamically import main content only if it is required
    import('./main');
}
