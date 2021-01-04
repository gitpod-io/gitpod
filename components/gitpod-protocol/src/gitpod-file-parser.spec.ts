/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { suite, test } from "mocha-typescript"
import * as chai from "chai"

import { WorkspaceConfig } from './protocol';
import { GitpodFileParser } from './gitpod-file-parser';

const expect = chai.expect

const DEFAULT_IMAGE = "default-image";
const DEFAULT_CONFIG = <WorkspaceConfig>{ image: DEFAULT_IMAGE };

@suite class TestGitpodFileParser {

    protected parser: GitpodFileParser;

    public before() {
        this.parser = new GitpodFileParser();
    }

    @test public testOnlyOnePort() {
        const content =
            `ports:\n` +
            `  - port: 5555`;

        const result = this.parser.parse(content, {}, DEFAULT_CONFIG);
        expect(result.config).to.deep.equal({
            ports: [{
                port: 5555
            }],
            image: DEFAULT_IMAGE
        });
    }

    @test public testPortRange() {
        const content =
            `ports:\n` +
            `  - port: 5555\n` +
            `  - port: 3000-3999`; // should be filtered out by default

        const result = this.parser.parse(content, {}, DEFAULT_CONFIG);
        expect(result.config).to.deep.equal({
            ports: [{
                port: 5555
            }],
            image: DEFAULT_IMAGE
        });
    }

    @test public testPortRangeAccepted() {
        const content =
            `ports:\n` +
            `  - port: 5555\n` +
            `  - port: 3000-3999`; // should be included if explicitly supported

        const result = this.parser.parse(content, { acceptPortRanges: true }, DEFAULT_CONFIG);
        expect(result.config).to.deep.equal({
            ports: [{
                port: 5555
            }, {
                port: '3000-3999'
            }],
            image: DEFAULT_IMAGE
        });
    }

    @test public testSimpleTask() {
        const content =
            `tasks:\n` +
            `  - command: yarn`;

        const result = this.parser.parse(content, {}, DEFAULT_CONFIG);
        expect(result.config).to.deep.equal({
            tasks: [{
                command: "yarn"
            }],
            image: DEFAULT_IMAGE
        });
    }

    @test public testSimpleImage() {
        const imageName = "my-test-org/my-test-image:some-tag";
        const content =
            `image: "${imageName}"\n`;

        const result = this.parser.parse(content);
        expect(result.config).to.deep.equal({
            image: imageName
        });
    }

    @test public testComplexImageWithoutContext() {
        const dockerFileName = 'Dockerfile';
        const content =
            `image:\n  file: ${dockerFileName}\n`;

        const result = this.parser.parse(content);
        expect(result.config).to.deep.equal({
            image: {
                file: dockerFileName
            }
        });
    }

    @test public testComplexImageWithContext() {
        const dockerFileName = 'Dockerfile';
        const dockerContext = 'docker';
        const content =
            `image:\n  file: ${dockerFileName}\n  context: ${dockerContext}\n`;

        const result = this.parser.parse(content);
        expect(result.config).to.deep.equal({
            image: {
                file: dockerFileName,
                context: dockerContext
            }
        });
    }

    @test public testGitconfig() {
        const content =
`
gitConfig:
    core.autocrlf: input
`;

        const result = this.parser.parse(content, {}, DEFAULT_CONFIG);
        expect(result.config).to.deep.equal({
            gitConfig: {
                "core.autocrlf": "input"
            },
            image: DEFAULT_IMAGE
        });
    }

    @test public testBrokenConfig() {
        const content =
            `image: 42\n`;

        const result = this.parser.parse(content, {}, DEFAULT_CONFIG);
        expect(result.config).to.deep.equal({
            image: DEFAULT_IMAGE
        });
    }
}
module.exports = new TestGitpodFileParser()   // Only to circumvent no usage warning :-/
