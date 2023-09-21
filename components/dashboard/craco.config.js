/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
const { when } = require("@craco/craco");
const webpack = require("webpack");

module.exports = {
    style: {
        postcss: {
            mode: "file",
        },
    },
    eslint: {
        mode: "file",
    },
    webpack: {
        configure: {
            resolve: {
                fallback: {
                    crypto: require.resolve("crypto-browserify"),
                    stream: require.resolve("stream-browserify"),
                    url: require.resolve("url"),
                    util: require.resolve("util"),
                    net: false,
                    path: false,
                    fs: false,
                    os: false,
                },
            },
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
            plugins: [
                new webpack.ProvidePlugin({
                    process: "process/browser",
                    Buffer: ["buffer", "Buffer"],
                }),
            ],
        },
    },
    devServer: {
        client: {
            webSocketURL: {
                hostname: process.env.HMR_HOST ? new URL(process.env.HMR_HOST).hostname : "localhost",
                port: process.env.HMR_HOST ? 443 : 3001,
                protocol: "wss",
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
