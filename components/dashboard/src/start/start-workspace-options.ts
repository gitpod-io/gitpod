/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { GitpodServer } from "@gitpod/gitpod-protocol";

export namespace StartWorkspaceOptions {
    // The workspace class to use for the workspace. If not specified, the default workspace class is used.
    export const WORKSPACE_CLASS = "workspaceClass";

    // The editor to use for the workspace. If not specified, the default editor is used.
    export const EDITOR = "editor";

    export function parseSearchParams(search: string): GitpodServer.StartWorkspaceOptions {
        const params = new URLSearchParams(search);
        const options: GitpodServer.StartWorkspaceOptions = {};
        const workspaceClass = params.get(StartWorkspaceOptions.WORKSPACE_CLASS);
        if (workspaceClass) {
            options.workspaceClass = workspaceClass;
        }
        const editorParam = params.get(StartWorkspaceOptions.EDITOR);
        if (editorParam) {
            if (editorParam?.endsWith("-latest")) {
                options.ideSettings = {
                    defaultIde: editorParam.slice(0, -7),
                    useLatestVersion: true,
                };
            } else {
                options.ideSettings = {
                    defaultIde: editorParam,
                    useLatestVersion: false,
                };
            }
        }
        return options;
    }

    export function toSearchParams(options: GitpodServer.StartWorkspaceOptions): string {
        const params = new URLSearchParams();
        if (options.workspaceClass) {
            params.set(StartWorkspaceOptions.WORKSPACE_CLASS, options.workspaceClass);
        }
        if (options.ideSettings && options.ideSettings.defaultIde) {
            const ide = options.ideSettings.defaultIde;
            const latest = options.ideSettings.useLatestVersion;
            params.set(StartWorkspaceOptions.EDITOR, latest ? ide + "-latest" : ide);
        }
        return params.toString();
    }
}
