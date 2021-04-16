/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */


import { MarkdownPreviewHandler } from '@theia/preview/lib/browser/markdown'
import URI from '@theia/core/lib/common/uri';
import { DiffUris } from '@theia/core/lib/browser';

export class GitpodMarkdownPreviewHandler extends MarkdownPreviewHandler {

    canHandle(uri: URI): number {
        if (DiffUris.isDiffUri(uri)) {
            return 0;
        }
        return uri.path.ext.toLowerCase() === '.md' ? 500 : 0;
    }
}