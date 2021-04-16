/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/// <reference types='@theia/monaco/src/typings/monaco'/>

declare module monaco.services {

    export interface IChange {
        readonly originalStartLineNumber: number;
        readonly originalEndLineNumber: number;
        readonly modifiedStartLineNumber: number;
        readonly modifiedEndLineNumber: number;
    }

    export interface IEditorWorkerService {
        canComputeDirtyDiff(original: Uri, modified: Uri): boolean;
        computeDirtyDiff(original: Uri, modified: Uri, ignoreTrimWhitespace: boolean): Promise<IChange[]>;
    }

    export module StaticServices {
        export const editorWorkerService: LazyStaticService<IEditorWorkerService>;
    }

}