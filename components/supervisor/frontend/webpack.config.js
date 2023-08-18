/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @ts-check

const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    target: "web",
    entry: {
        main: path.resolve(__dirname, "lib/index.js"),
    },
    output: {
        filename: "[name].js",
        chunkFilename: "[name].js",
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
            crypto: require.resolve("crypto-browserify"),
            stream: require.resolve("stream-browserify"),
        },
    },
    devtool: "source-map",
    plugins: [
        new CopyWebpackPlugin({
            patterns: [{ from: "public", to: "." }],
        }),
    ],
};
