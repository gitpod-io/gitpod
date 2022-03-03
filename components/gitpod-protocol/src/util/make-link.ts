/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

function isOpenNewTab(event: MouseEvent): boolean {
    return event.metaKey || event.ctrlKey;
}

export function makeLink(node: HTMLElement, url: string, hover: string): void {
    node.onclick = (event) => {
        let target = '_self';
        if (isOpenNewTab(event)) {
            target = '_blank';
        }
        window.open(url, target);
    };
    node.style.cursor = 'pointer';
    node.title = hover;
}
