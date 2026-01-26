/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
const { when } = require("@craco/craco");
const path = require("path");
const webpack = require("webpack");

function withEndingSlash(str) {
    return str.endsWith("/") ? str : str + "/";
}

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
                alias: {
                    "@podkit": path.resolve(__dirname, "./src/components/podkit/"),
                },
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
                    {
                        // Import HTML files as raw strings (for minimal-login.html)
                        test: /minimal-login\.html$/,
                        type: "asset/source",
                    },
                ],
            },
            plugins: [
                new webpack.ProvidePlugin({
                    process: "process/browser",
                    Buffer: ["buffer", "Buffer"],
                }),
            ],
            // If ASSET_PATH is set, we imply that we also want a statically named main.js, so we can reference it from the outside
            output: !!process.env.ASSET_PATH
                ? {
                      ...(webpack?.configure?.output || {}),
                      filename: (pathData) => {
                          return pathData.chunk.name === "main" ? "static/js/main.js" : undefined;
                      },
                      publicPath: withEndingSlash(process.env.ASSET_PATH),
                  }
                : undefined,
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
