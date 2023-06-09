/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
const { when } = require("@craco/craco");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
    eslint: {
        rules: {
            "import/no-anonymous-default-export": "error",
            "react/jsx-no-constructed-context-values": "error",
        },
        ignorePatterns: ["**/node_modules/**/*"],
    },
    webpack: {
        plugins: {
            add: [
                new NodePolyfillPlugin({
                    includeAliases: ["Buffer", "crypto", "stream", "path", "os", "process"],
                }),
            ],
        },
        alias: {
            fs: require.resolve("browserify-fs"),
            http: require.resolve("stream-http"),
            net: require.resolve("net-browserify"),
            zlib: require.resolve("browserify-zlib"),
            async_hooks: false,
        },
        // configure: {
        //     resolve: {
        //         fallback: {
        //             fs: require.resolve("browserify-fs"),
        //             net: require.resolve("net-browserify"),
        //             zlib: require.resolve("browserify-zlib"),
        //             // http: require.resolve("stream-http"),
        //             async_hooks: false,
        //             // crypto: false,
        //             // path: require.resolve("path-browserify"),
        //             // crypto: require.resolve("crypto-browserify"),
        //             // stream: require.resolve("stream-browserify"),
        //         },
        //     },
        // },
    },
    style: {
        postcss: {
            plugins: [require("tailwindcss"), require("autoprefixer")],
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
