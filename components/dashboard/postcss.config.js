/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

/** @type {import('postcss-load-config').Config} */
const config = {
    plugins: {
        "postcss-import": {},
        tailwindcss: {},
        autoprefixer: {},
    },
};

module.exports = config;
