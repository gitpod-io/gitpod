/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/**
 * Ensures a returnTo URL has a fragment to prevent OAuth token inheritance attacks.
 *
 * When OAuth providers use response_type=token, they redirect with access tokens
 * in URL fragments. If the returnTo URL doesn't have a fragment, browsers inherit
 * the current page's fragment, potentially exposing tokens to malicious sites.
 *
 * Uses an empty fragment (#) to prevent inheritance without interfering with
 * Gitpod's context provider resolution.
 */
export function ensureUrlHasFragment(url: string): string {
    try {
        const parsedUrl = new URL(url);
        // If URL already has a fragment, return as-is
        if (parsedUrl.hash) {
            return url;
        }
        // Add empty fragment to prevent inheritance
        // Using just "#" to avoid interfering with context provider resolution that
        // treats fragments as git URLs
        return url + "#";
    } catch (error) {
        // If URL is invalid, add fragment anyway
        return url + "#";
    }
}
