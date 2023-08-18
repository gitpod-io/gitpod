/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
const { when } = require("@craco/craco");

module.exports = {
    style: {
        postcss: {
            plugins: [require("tailwindcss"), require("autoprefixer")],
        },
    },
    webpack: {
        configure: {
            resolve: { fallback: { crypto: false, net: false, path: false, fs: false, os: false } },
            module: {
                rules: [
                    {
                        test: /\.m?js$/,
                        resolve: {
                            fullySpecified: false,
                        },
                    },
                ],
            },
        },
    },
    ...when(process.env.GP_DEV_HOST && process.env.GP_DEV_COOKIE, () => ({
        devServer: {
            proxy: {
                "/api": {
                    target: "https://" + process.env.GP_DEV_HOST,
                    ws: true,
                    headers: {
                        host: process.env.GP_DEV_HOST,
                        origin: "https://" + process.env.GP_DEV_HOST,
                        cookie: process.env.GP_DEV_COOKIE,
                    },
                },
            },
        },
    })),
};
