/**
 * Copyright (c) 2026 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { expect } from "chai";
import { suite, test } from "@testdeck/mocha";
import { Repository, User } from "@gitpod/gitpod-protocol";
import { GitLabApi, GitLab } from "./api";
import { GitlabContextParser } from "./gitlab-context-parser";

class TestableGitlabContextParser extends GitlabContextParser {
    private resolveRepositoryLookup!: (repository: Repository) => void;
    private readonly repositoryLookup = new Promise<Repository>((resolve) => {
        this.resolveRepositoryLookup = resolve;
    });

    protected override fetchRepo(): Promise<Repository> {
        return this.repositoryLookup;
    }

    public handleTreeContextForTest(segments: string[]) {
        return this.handleTreeContext({} as User, "gitlab.example.com", "foo/bar/f/develop-b", "topic", segments);
    }

    public finishRepositoryLookup() {
        this.resolveRepositoryLookup({} as Repository);
    }
}

@suite
class GitlabContextParserUnitSpec {
    @test
    public async handlesMissingRefRejectionWhileRepositoryLookupIsPending() {
        const encodedMissingRef = "distribution%E2%80%8B_lettuce_v1";
        const parser = new TestableGitlabContextParser();
        (parser as any).gitlabApi = {
            run: async () => new GitLab.ApiError("not found", 404),
        } as unknown as GitLabApi;

        const unhandledRejections: unknown[] = [];
        const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
        process.on("unhandledRejection", onUnhandledRejection);

        try {
            const result = parser.handleTreeContextForTest([encodedMissingRef]).then(
                () => undefined,
                (error) => error,
            );

            await new Promise<void>((resolve) => setImmediate(resolve));

            expect(unhandledRejections).to.be.empty;
            const error = await result;
            expect(error).to.be.instanceOf(Error);
            expect(error.message).to.include(encodedMissingRef);
        } finally {
            parser.finishRepositoryLookup();
            process.off("unhandledRejection", onUnhandledRejection);
        }
    }
}

module.exports = new GitlabContextParserUnitSpec();
