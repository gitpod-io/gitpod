/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @ts-check

const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");

/**@type {import('webpack').Configuration}*/
module.exports = {
    target: "web",
    entry: {
        main: path.resolve(__dirname, "lib/index.js"),
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "dist"),
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\\.js$/,
                enforce: "pre",
                loader: "source-map-loader",
            },
        ],
    },
    resolve: {
        fallback: {
            crypto: false,
            fs: false,
            child_process: false,
            tls: false,
            net: false,
            os: require.resolve("os-browserify/browser"),
            path: require.resolve("path-browserify"),
            url: false,
            util: false,
            process: false,
        },
    },
    devtool: "source-map",
    plugins: [
        new CopyWebpackPlugin({
            patterns: [{ from: "public", to: "." }],
        }),
        new webpack.ProvidePlugin({
            Buffer: ["buffer", "Buffer"],
            setImmediate: ["timers-browserify", "setImmediate"],
        }),
    ],
};
