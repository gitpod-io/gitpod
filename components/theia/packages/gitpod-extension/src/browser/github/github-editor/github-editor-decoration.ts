/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

export namespace GitHubEditorDecoration {

    export function createNewConversationDecoration(position: number): monaco.editor.IModelDeltaDecoration |  undefined {
        return createConversationDecoration(position, NEW_CONVERSATION_DECORATION_OPTIONS);
    }

    export function createConversationDecoration(
        position: number,
        options: monaco.editor.IModelDecorationOptions = CONVERSATIONS_DECORATION_OPTIONS
    ): monaco.editor.IModelDeltaDecoration |  undefined {
        if (position === 0) {
            return undefined;
        }
        return {
            range: new monaco.Range(position, 1, position, 1),
            options
        };
    }

    export const CONVERSATIONS_DECORATION_OPTIONS: monaco.editor.IModelDecorationOptions = {
        isWholeLine: true,
        zIndex: 10,
        linesDecorationsClassName: 'icon-comment-discussion',
        hoverMessage: { value: 'Toggle Conversations' }
    }

    export const NEW_CONVERSATION_DECORATION_OPTIONS: monaco.editor.IModelDecorationOptions = {
        isWholeLine: true,
        zIndex: 10,
        linesDecorationsClassName: 'icon-comment-discussion new',
        hoverMessage: { value: 'Start New Conversations' }
    }

}