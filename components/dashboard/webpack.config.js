/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

const webpack = require('webpack')
const path = require('path')

const isProduction = process.env.WEBPACK_MODE === 'production';
const isOSSBuild = process.env.GITPOD_OSS_BUILD === 'true';


const entrypoints = require('./webpack.entrypoints')
module.exports = {
    devServer: {
        contentBase: [
            path.join(__dirname, "public"),
            path.join(__dirname, "ee/public"),
        ],
        compress: true,
        host: "0.0.0.0",
        port: 3001,
        disableHostCheck: true
    },
    entry: entrypoints('./src', './ee/src', isOSSBuild),
    output: {
        filename: '[name].js',
        chunkFilename: '[name].js',
        path: path.resolve(__dirname, 'dist')
    },
    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: [".ts", ".tsx", ".js", ".json"]
    },
    node: {
        fs: 'empty',
        child_process: 'empty',
        net: 'empty',
        crypto: 'empty',
        tls: 'empty'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader"
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|jpg|gif)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {}
                    }
                ]
            },
            {
                test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: "url-loader?limit=10000&mimetype=application/font-woff"
            },
            {
                test: /\.svg*/,
                loader: "svg-inline-loader"
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
    devtool: isProduction ? '' : 'source-map',
    externals: {
        "moment": "moment",
        'react': 'React',
        'react-dom': 'ReactDOM'
    }
}
