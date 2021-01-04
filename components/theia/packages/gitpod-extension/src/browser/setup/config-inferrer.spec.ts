/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

require('reflect-metadata');
import 'mocha';
import * as chai from 'chai';
import { ConfigInferrer, FS } from './config-inferrer';
import { Path } from '@theia/core';
import { WorkspaceConfig } from '@gitpod/gitpod-protocol';

function fs(files: {[path:string]:string}): FS {
    return {
        async exists(path: Path|string) {
            return path.toString() in files;
        },
        async getFullPath(path: Path|string) {
            return new Path(path.toString());
        },
        async list(path: Path|string) {
            return Object.keys(files).filter(c => c.startsWith(path.toString())).map(c => new Path(files[c]));
        },
        async read(path: Path|string) {
            return files[path.toString()];
        },
    }
}

async function expect(files: {[path:string]:string}, config: WorkspaceConfig): Promise<void> {
    const cf = new ConfigInferrer();
    const result = await cf.getConfig(fs(files));
    chai.assert.equal(JSON.stringify(result, null, '  '), JSON.stringify(config, null, '  '));
}

describe('config inferrer', () => {
    it('check node', 
        async () => expect({
            'yarn.lock': '',
            'package.json': `
                {
                    "scripts": {
                        "prepare": "yarn run clean && yarn run build",
                        "clean": "npx rimraf lib",
                        "build": "npx tsc",
                        "watch": "npx tsc -w"
                    }
                }
            `        
        },{
            tasks: [
                {
                    init: "yarn install && yarn run build",
                    command: "yarn run watch"
                }
            ]
        })
    ),
    it('[java] mvn wrapper', 
        async () => expect({
            'pom.xml': '',
            'mvnw': '' 
        },{
            tasks: [
                {
                    init: "./mvnw install -DskipTests=false"
                }
            ]
        })
    ),
    it('[java] mvn', 
        async () => expect({
            'pom.xml': ''
        },{
            tasks: [
                {
                    init: "mvn install -DskipTests=false"
                }
            ]
        })
    ),
    it('[java] gradle', 
        async () => expect({
            'build.gradle': '',
            'pom.xml': '' 
        },{
            tasks: [
                {
                    init: "gradle build"
                }
            ]
        })
    ),
    it('[java] gradle wrapper', 
        async () => expect({
            'build.gradle': '',
            'gradlew': '' 
        },{
            tasks: [
                {
                    init: "./gradlew build"
                }
            ]
        })
    ),
    it('[python] pip install', 
        async () => expect({
            'requirements.txt': ''
        },{
            tasks: [
                {
                    init: "pip install -r ./requirements.txt"
                }
            ]
        })
    ),
    it('[go] go install', 
        async () => expect({
            'go.mod': ''
        },{
            tasks: [
                {
                    init: "go get && go build ./... && go test ./...",
                    command: "go run"
                }
            ]
        })
    ),
    it('[rust] cargo', 
        async () => expect({
            'Cargo.toml': ''
        },{
            tasks: [
                {
                    init: "cargo build",
                    command: "cargo watch -x run"
                }
            ]
        })
    ),
    it('[make] make', 
        async () => expect({
            'Makefile': ''
        },{
            tasks: [
                {
                    init: "make"
                }
            ]
        })
    ),
    it('[make] cmake', 
        async () => expect({
            'CMakeLists.txt': ''
        },{
            tasks: [
                {
                    init: "cmake ."
                }
            ]
        })
    ),
    it('[dotnet] nuget',
        async () => expect({
            'packages.config': ''
        },{
            tasks: [
                {
                    init: 'nuget install'
                }
            ]
        })
    ),
    it('[ruby] gemfile',
        async () => expect({
            'Gemfile': ''
        },{
            tasks: [
                {
                    init: 'bundle install'
                }
            ]
        })
    )
})
