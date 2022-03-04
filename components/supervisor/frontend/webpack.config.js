/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

// @ts-check

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: {
        main: path.resolve(__dirname, 'lib/index.js')
    },
    output: {
        filename: '[name].js',
        chunkFilename: '[name].js',
        path: path.resolve(__dirname, 'dist')
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\\.js$/,
                enforce: 'pre',
                loader: 'source-map-loader'
            },
            {
                test: /\.js$/,
                // include only es6 dependencies to transpile them to es5 classes
                include: /vscode-ws-jsonrpc|vscode-jsonrpc|vscode-languageserver-protocol|vscode-languageserver-types/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                        plugins: [
                            // reuse runtime babel lib instead of generating it in each js file
                            '@babel/plugin-transform-runtime',
                            // ensure that classes are transpiled
                            '@babel/plugin-transform-classes'
                        ],
                        // see https://github.com/babel/babel/issues/8900#issuecomment-431240426
                        sourceType: 'unambiguous',
                        cacheDirectory: true
                    }
                }
            }
        ]
    },
    node: {
        fs: 'empty',
        child_process: 'empty',
        net: 'empty',
        crypto: 'empty',
        tls: 'empty'
    },
    devtool: 'source-map',
    plugins: [new CopyWebpackPlugin({
        patterns: [
            { from: 'public', to: '.' }
        ]
    })]
};