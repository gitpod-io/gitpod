/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Workspace } from '.';

/**
 * The whole point of these methods is to overcome inconsistencies in our data model.
 * Ideally we remove it at some point once we fixed our model, as it:
 *  - duplicates logic
 *  - but additional burden on clients (using this, copying this to other languages!)
 *
 * TODO(gpl) See if we can get this into `server` code to remove the burden from clients
 */
export namespace ContextURL {
    export const INCREMENTAL_PREBUILD_PREFIX = 'incremental-prebuild';
    export const PREBUILD_PREFIX = 'prebuild';
    export const IMAGEBUILD_PREFIX = 'imagebuild';
    export const SNAPSHOT_PREFIX = 'snapshot';
    export const REFERRER_PREFIX = 'referrer:';

    /**
     * This function will (try to) return the HTTP(S) URL of the context the user originally created this workspace on.
     * Especially it will not contain any modifiers or be of different scheme than HTTP(S).
     *
     * Use this function if you need to provided a _working_ URL to the original context.
     * @param ws
     * @returns
     */
    export function getNormalizedURL(ws: Pick<Workspace, 'context' | 'contextURL'> | undefined): URL | undefined {
        const normalized = normalize(ws);
        if (!normalized) {
            return undefined;
        }

        try {
            return new URL(normalized);
        } catch (err) {
            console.error(`unable to parse URL from normalized contextURL: '${normalized}'`, err);
        }
        return undefined;
    }

    function normalize(ws: Pick<Workspace, 'context' | 'contextURL'> | undefined): string | undefined {
        if (!ws) {
            return undefined;
        }
        if (ws.context.normalizedContextURL) {
            return ws.context.normalizedContextURL;
        }

        // fallback: we do not yet set normalizedContextURL on all workspaces, yet, let alone older existing workspaces
        let fallback: string | undefined = undefined;
        try {
            fallback = removePrefixes(ws.contextURL);
        } catch (err) {
            console.error(`unable to remove prefixes from contextURL: '${ws.contextURL}'`, err);
        }
        return fallback;
    }

    /**
     * The field "contextUrl" might contain prefixes like:
     *  - envvar1=value1/...
     *  - prebuild/...
     * This is the analogon to the (Prefix)ContextParser structure in "server".
     */
    function removePrefixes(contextUrl: string | undefined): string | undefined {
        if (contextUrl === undefined) {
            return undefined;
        }

        const segments = contextUrl.split('/');
        if (segments.length === 1) {
            return segments[0]; // this might be something, we just try
        }

        const segmentsToURL = (offset: number): string => {
            let rest = segments.slice(offset).join('/');
            if (/^git@[^:\/]+:/.test(rest)) {
                rest = rest.replace(/^git@([^:\/]+):/, 'https://$1/');
            }
            if (!rest.startsWith('http')) {
                rest = 'https://' + rest;
            }
            return rest;
        };

        const firstSegment = segments[0];
        if (
            firstSegment === PREBUILD_PREFIX ||
            firstSegment === INCREMENTAL_PREBUILD_PREFIX ||
            firstSegment === IMAGEBUILD_PREFIX ||
            firstSegment === SNAPSHOT_PREFIX ||
            firstSegment.startsWith(REFERRER_PREFIX)
        ) {
            return segmentsToURL(1);
        }

        // check for env vars
        if (firstSegment.indexOf('=') !== -1) {
            return segmentsToURL(1);
        }

        return segmentsToURL(0);
    }
}
