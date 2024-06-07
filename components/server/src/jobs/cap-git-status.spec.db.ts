/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as chai from "chai";
const expect = chai.expect;
import { suite, test } from "@testdeck/mocha";

import { WorkspaceInstance, WorkspaceInstanceRepoStatus } from "@gitpod/gitpod-protocol";
import { DBWorkspaceInstance, TypeORM, WorkspaceDB, resetDB } from "@gitpod/gitpod-db/lib";
import { Repository } from "typeorm";
import { CapGitStatus } from "./cap-git-status";
import { createTestContainer } from "../test/service-testing-container-module";
import { Container } from "inversify";
import { Experiments } from "@gitpod/gitpod-protocol/lib/experiments/configcat-server";

const workspaceId = "ws123";

@suite
class CapGitStatusTest {
    container: Container;
    db: WorkspaceDB;

    async before() {
        this.container = createTestContainer();
        Experiments.configureTestingClient({
            api_validate_git_status_length: true,
        });
        await this.wipeRepos();

        this.db = this.container.get<WorkspaceDB>(WorkspaceDB);
    }

    async after() {
        // await this.wipeRepos();
    }

    async wipeRepos() {
        const typeorm = this.container.get<TypeORM>(TypeORM);
        await resetDB(typeorm);
    }

    instance(nr: number) {
        const gitStatus: WorkspaceInstanceRepoStatus = {
            branch: "main",
            latestCommit: "abc",
            untrackedFiles: [],
        };
        for (let i = 0; i < 100; i++) {
            gitStatus.untrackedFiles?.push(`file_${i}_${"a".repeat(100)}`);
        }
        gitStatus.totalUntrackedFiles = gitStatus.untrackedFiles?.length;

        const instance: WorkspaceInstance = {
            id: `wsi${nr}`,
            workspaceId,
            creationTime: new Date(2018, 2, 16, 10, 0, 0).toISOString(),
            ideUrl: "lalalal",
            region: "somewhere",
            workspaceImage: "eu.gcr.io/gitpod-io/workspace-images@sha256:123",
            configuration: {
                ideImage: "eu.gcr.io/gitpod-io/ide@sha256:123",
            },
            status: {
                phase: "stopped",
                conditions: {},
                version: 1,
            },
            gitStatus,
        };
        return instance;
    }

    @test()
    public async capGeneratedStatus() {
        await this.db.storeInstance(this.instance(1));

        const job = this.container.get<CapGitStatus>(CapGitStatus);
        expect(await findInstancesWithLengthyGitStatus(job, this.db), "instances with lengthy git status").to.equal(1);
        expect(await job.run(), "number of capped instances").to.equal(1);
        expect(await findInstancesWithLengthyGitStatus(job, this.db), "instances with lengthy git status").to.equal(0);
    }

    @test()
    public async capRealStatus() {
        const instance = this.instance(1);
        instance.gitStatus = <WorkspaceInstanceRepoStatus>(
            JSON.parse(
                `{"branch": "main", "latestCommit": "0516cdc28a52d22613019da1e1360e28a4118351", "untrackedFiles": [".gitpod.yml", "node_modules/.bin/acorn", "node_modules/.bin/ansi-html", "node_modules/.bin/autoprefixer", "node_modules/.bin/browserslist", "node_modules/.bin/css-blank-pseudo", "node_modules/.bin/css-has-pseudo", "node_modules/.bin/css-prefers-color-scheme", "node_modules/.bin/cssesc", "node_modules/.bin/detect", "node_modules/.bin/detect-port", "node_modules/.bin/ejs", "node_modules/.bin/escodegen", "node_modules/.bin/esgenerate", "node_modules/.bin/eslint", "node_modules/.bin/esparse", "node_modules/.bin/esvalidate", "node_modules/.bin/he", "node_modules/.bin/html-minifier-terser", "node_modules/.bin/import-local-fixture", "node_modules/.bin/is-docker", "node_modules/.bin/jake", "node_modules/.bin/jest", "node_modules/.bin/jiti", "node_modules/.bin/js-yaml", "node_modules/.bin/jsesc", "node_modules/.bin/json5", "node_modules/.bin/loose-envify", "node_modules/.bin/lz-string", "node_modules/.bin/mime", "node_modules/.bin/mkdirp", "node_modules/.bin/multicast-dns", "node_modules/.bin/nanoid", "node_modules/.bin/node-which", "node_modules/.bin/parser", "node_modules/.bin/rc", "node_modules/.bin/react-scripts", "node_modules/.bin/regjsparser", "node_modules/.bin/resolve", "node_modules/.bin/rimraf", "node_modules/.bin/rollup", "node_modules/.bin/semver", "node_modules/.bin/serve", "node_modules/.bin/sucrase", "node_modules/.bin/sucrase-node", "node_modules/.bin/svgo", "node_modules/.bin/tailwind", "node_modules/.bin/tailwindcss", "node_modules/.bin/terser", "node_modules/.bin/tsc", "node_modules/.bin/tsserver", "node_modules/.bin/update-browserslist-db", "node_modules/.bin/uuid", "node_modules/.bin/webpack", "node_modules/.bin/webpack-dev-server", "node_modules/.package-lock.json", "node_modules/@adobe/css-tools/History.md", "node_modules/@adobe/css-tools/LICENSE", "node_modules/@adobe/css-tools/Readme.md", "node_modules/@adobe/css-tools/dist/cjs/CssParseError.d.ts", "node_modules/@adobe/css-tools/dist/cjs/CssPosition.d.ts", "node_modules/@adobe/css-tools/dist/cjs/cssTools.js", "node_modules/@adobe/css-tools/dist/cjs/cssTools.js.map", "node_modules/@adobe/css-tools/dist/cjs/index.d.ts", "node_modules/@adobe/css-tools/dist/cjs/parse/index.d.ts", "node_modules/@adobe/css-tools/dist/cjs/stringify/compiler.d.ts", "node_modules/@adobe/css-tools/dist/cjs/stringify/index.d.ts", "node_modules/@adobe/css-tools/dist/cjs/type.d.ts", "node_modules/@adobe/css-tools/dist/esm/CssParseError.js", "node_modules/@adobe/css-tools/dist/esm/CssPosition.js", "node_modules/@adobe/css-tools/dist/esm/index.js", "node_modules/@adobe/css-tools/dist/esm/parse/index.js", "node_modules/@adobe/css-tools/dist/esm/stringify/compiler.js", "node_modules/@adobe/css-tools/dist/esm/stringify/index.js", "node_modules/@adobe/css-tools/dist/esm/type.js", "node_modules/@adobe/css-tools/dist/umd/cssTools.js", "node_modules/@adobe/css-tools/dist/umd/cssTools.js.map", "node_modules/@adobe/css-tools/package.json", "node_modules/@alloc/quick-lru/index.d.ts", "node_modules/@alloc/quick-lru/index.js", "node_modules/@alloc/quick-lru/license", "node_modules/@alloc/quick-lru/package.json", "node_modules/@alloc/quick-lru/readme.md", "node_modules/@ampproject/remapping/LICENSE", "node_modules/@ampproject/remapping/README.md", "node_modules/@ampproject/remapping/dist/remapping.mjs", "node_modules/@ampproject/remapping/dist/remapping.mjs.map", "node_modules/@ampproject/remapping/dist/remapping.umd.js", "node_modules/@ampproject/remapping/dist/remapping.umd.js.map", "node_modules/@ampproject/remapping/dist/types/build-source-map-tree.d.ts", "node_modules/@ampproject/remapping/dist/types/remapping.d.ts", "node_modules/@ampproject/remapping/dist/types/source-map-tree.d.ts", "node_modules/@ampproject/remapping/dist/types/source-map.d.ts", "node_modules/@ampproject/remapping/dist/types/types.d.ts", "node_modules/@ampproject/remapping/package.json", "node_modules/@babel/code-frame/LICENSE", "... and 37923 more"], "uncommitedFiles": ["moon"], "totalUntrackedFiles": 38023, "totalUncommitedFiles": 1}`,
            )
        );
        await this.db.storeInstance(instance);

        const job = this.container.get<CapGitStatus>(CapGitStatus);
        expect(await findInstancesWithLengthyGitStatus(job, this.db), "instances with lengthy git status").to.equal(1);
        expect(await job.run(), "number of capped instances").to.equal(1);
        expect(await findInstancesWithLengthyGitStatus(job, this.db), "instances with lengthy git status").to.equal(0);
    }
}

async function findInstancesWithLengthyGitStatus(job: CapGitStatus, db: WorkspaceDB): Promise<number> {
    const repo = await ((db as any).getWorkspaceInstanceRepo() as Promise<Repository<DBWorkspaceInstance>>);
    const instances = await job.findInstancesWithLengthyGitStatus(repo, 4096, 100);
    return instances.length;
}

module.exports = new CapGitStatusTest();
