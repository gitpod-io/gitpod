/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

module.exports = function entrypoints(srcPath, eeSrcPath, isOSSBuild) {
    return {
        'list-workspaces': `${srcPath}/list-workspaces.tsx`,
        'start-workspace': `${srcPath}/start-workspace.tsx`,
        'create-workspace': `${srcPath}/create-workspace.tsx`,
        'create-workspace-from-ref': `${srcPath}/create-workspace-from-ref.tsx`,
        '404': `${srcPath}/404.tsx`,
        'sorry': `${srcPath}/sorry.tsx`,
        'select-account': `${srcPath}/select-account.tsx`,
        'blocked': `${srcPath}/blocked.tsx`,
        'bootanimation': `${srcPath}/bootanimation.ts`,
        'access-control': `${srcPath}/access-control.tsx`,
        'settings': `${srcPath}/settings.tsx`,
        'login': `${srcPath}/login.tsx`,
        'first-steps': `${srcPath}/first-steps.tsx`,
        'tos': `${srcPath}/terms-of-service.tsx`,
        'install-github-app': `${srcPath}/install-github-app.tsx`,
        ...(!isOSSBuild && {
            'admin': `${eeSrcPath}/admin.tsx`,
            'license': `${eeSrcPath}/license.tsx`,
        })
    };
}