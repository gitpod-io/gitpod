/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as React from 'react';
import { VSXExtensionsWidget } from "@theia/vsx-registry/lib/browser/vsx-extensions-widget";
import { TreeElement } from '@theia/core/lib/browser/source-tree';

/**
 * patches the vsxextension source and adds info for the user when an extension is missing
 */
export function addUserInfoToSearchResult(searchResultWidget: VSXExtensionsWidget) {
    const extSource = searchResultWidget['extensionsSource'];
    const originalGetElements = extSource.getElements.bind(extSource);
    function* newGetElements(): IterableIterator<TreeElement> {
        yield* originalGetElements();
        yield {
            render: () => <div>
                Not found what you are looking for? <a href="https://www.gitpod.io/docs/vscode-extensions/#where-do-i-find-extensions" target="_blank">Learn More</a>
            </div>
        };
    }
    extSource.getElements = newGetElements;
}