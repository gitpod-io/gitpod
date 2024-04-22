/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const repositoriesRoutes = {
    Main: () => "/repositories",
    Detail: (id: string) => `/repositories/${id}`,
    Configuration: (id: string) => `/repositories/${id}/configuration`,
    PrebuildsSettings: (id: string) => `/repositories/${id}/prebuilds`,
    WorkspaceSettings: (id: string) => `/repositories/${id}/workspaces`,
    EditorSettings: (id: string) => `/repositories/${id}/editors`,
    Prebuilds: () => `/prebuilds`,
    PrebuildDetail: (prebuildId: string) => `/prebuilds/${prebuildId}`,
};
