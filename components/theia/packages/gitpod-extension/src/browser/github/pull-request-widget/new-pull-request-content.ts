/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export namespace NewPullRequestContent {
    export const maxLineLength = 72;
    export const lineDelimiter = '\n';
    export function parse(message: string): {
        title: string
        body: string
    } {
        const newLineIndex = message.indexOf(lineDelimiter);
        const index = newLineIndex === -1 ? maxLineLength : Math.min(maxLineLength, newLineIndex);
        const body = message.substr(index).trim();
        const titleEnd = message.substr(index, 1).trim().length === 0 ? '' : '...';
        const title = message.substr(0, index).trim() + titleEnd;
        return { title, body }
    }
}
