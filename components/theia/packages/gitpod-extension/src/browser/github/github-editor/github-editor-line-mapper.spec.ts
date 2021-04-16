/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as assert from 'assert';
import { Event } from "@theia/core";
import { suite, test } from "mocha-typescript"
import { GitHubEditorLineMapper } from "./github-editor-line-mapper";

@suite
export class GitHubEditorLineMapperTest {

    @test
    testChangedInsertion_0_to_0(): void {
        this.assertChangedInsertion({
            pullRequestLineNumber: 0,
            lineNumber: 0
        });
    }

    @test
    testChangedInsertion_1_to_1(): void {
        this.assertChangedInsertion({
            pullRequestLineNumber: 1,
            lineNumber: 1
        });
    }

    @test
    testChangedInsertion_2_to_2(): void {
        this.assertChangedInsertion({
            pullRequestLineNumber: 2,
            lineNumber: 2
        });
    }

    @test
    testChangedInsertion_0_to_3(): void {
        this.assertChangedInsertion({
            pullRequestLineNumber: 0,
            lineNumber: 3
        });
    }

    @test
    testChangedInsertion_0_to_23(): void {
        this.assertChangedInsertion({
            pullRequestLineNumber: 0,
            lineNumber: 23
        });
    }

    @test
    testChangedInsertion_3_to_24(): void {
        this.assertChangedInsertion({
            pullRequestLineNumber: 3,
            lineNumber: 24
        });
    }

    protected assertChangedInsertion(options: {
        pullRequestLineNumber: number,
        lineNumber: number
    }): void {
        const changes = [this.createLineChange(1, 2, 1, 23)];
        this.assertMapping({
            ...options,
            changes
        });
    }

    @test
    testComplexChange_0_to_0(): void {
        this.assertComplexChange({
            pullRequestLineNumber: 0,
            lineNumber: 0
        });
    }

    @test
    testComplexChange_0_to_1(): void {
        this.assertComplexChange({
            pullRequestLineNumber: 0,
            lineNumber: 1
        });
    }

    @test
    testComplexChange_1_to_2(): void {
        this.assertComplexChange({
            pullRequestLineNumber: 1,
            lineNumber: 2
        });
    }

    @test
    testComplexChange_2_to_3(): void {
        this.assertComplexChange({
            pullRequestLineNumber: 2,
            lineNumber: 3
        });
    }

    @test
    testComplexChange_3_to_4(): void {
        this.assertComplexChange({
            pullRequestLineNumber: 3,
            lineNumber: 4
        });
    }

    @test
    testComplexChange_4_to_5(): void {
        this.assertComplexChange({
            pullRequestLineNumber: 4,
            lineNumber: 5
        });
    }

    @test
    testComplexChange_5_to_0(): void {
        this.assertComplexChange({
            pullRequestLineNumber: 5,
            lineNumber: 0
        });
    }

    /**
     * var original = ['foo', 'abcd', 'efgh', 'BAR', 'RAB'];
	 * var modified = ['hello', 'foo', 'zzzefgh', 'xxx', 'BAR'];
     */
    protected assertComplexChange(options: {
        pullRequestLineNumber: number,
        lineNumber: number
    }): void {
        const changes = [
            this.createLineInsertion(1, 1, 0),
            this.createLineChange(2, 3, 3, 4),
            this.createLineDeletion(5, 5, 5)
        ];
        this.assertMapping({
            ...options,
            changes
        });
    }

    @test
    testChanged_0_to_0(): void {
        this.assertChanged({
            pullRequestLineNumber: 0,
            lineNumber: 0
        });
    }

    @test
    testChanged_1_to_1(): void {
        this.assertChanged({
            pullRequestLineNumber: 1,
            lineNumber: 1
        });
    }

    @test
    testChanged_2_to_2(): void {
        this.assertChanged({
            pullRequestLineNumber: 2,
            lineNumber: 2
        });
    }

    @test
    testChanged_3_to_0(): void {
        this.assertChanged({
            pullRequestLineNumber: 3,
            lineNumber: 0
        });
    }

    @test
    testChanged_4_to_3(): void {
        this.assertChanged({
            pullRequestLineNumber: 4,
            lineNumber: 3
        });
    }

    /**
     * var original = ['foo', 'abcd', 'efgh', 'BAR'];
	 * var modified = ['foo', 'abcz', 'BAR'];
     */
    protected assertChanged(options: {
        pullRequestLineNumber: number,
        lineNumber: number
    }): void {
        const changes = [this.createLineChange(2, 3, 2, 2)];
        this.assertMapping({
            ...options,
            changes
        });
    }

    @test
    testInsertion_0_to_0(): void {
        this.assertInsertion({
            pullRequestLineNumber: 0,
            lineNumber: 0
        });
    }

    @test
    testInsertion_1_to_1(): void {
        this.assertInsertion({
            pullRequestLineNumber: 1,
            lineNumber: 1
        });
    }

    @test
    testInsertion_2_to_2(): void {
        this.assertInsertion({
            pullRequestLineNumber: 2,
            lineNumber: 2
        });
    }

    @test
    testInsertion_0_to_3(): void {
        this.assertInsertion({
            pullRequestLineNumber: 0,
            lineNumber: 3
        });
    }

    @test
    testInsertion_3_to_4(): void {
        this.assertInsertion({
            pullRequestLineNumber: 3,
            lineNumber: 4
        });
    }

    @test
    testInsertion_0_to_5(): void {
        this.assertInsertion({
            pullRequestLineNumber: 0,
            lineNumber: 5
        });
    }

    @test
    testInsertion_4_to_6(): void {
        this.assertInsertion({
            pullRequestLineNumber: 4,
            lineNumber: 6
        });
    }

    /**
     * var original = ['line1', 'line2', 'line3', 'line4'];
     * var modified = ['line1', 'line2', 'new line', 'line3', 'another new line', 'line4'];
     */
    protected assertInsertion(options: {
        pullRequestLineNumber: number,
        lineNumber: number
    }): void {
        const changes = [this.createLineInsertion(3, 3, 2), this.createLineInsertion(5, 5, 3)];
        this.assertMapping({
            ...options,
            changes
        });
    }

    @test
    testDeletion_0_to_0(): void {
        this.assertDeletion({
            pullRequestLineNumber: 0,
            lineNumber: 0
        });
    }

    @test
    testDeletion_1_to_1(): void {
        this.assertDeletion({
            pullRequestLineNumber: 1,
            lineNumber: 1
        });
    }

    @test
    testDeletion_2_to_2(): void {
        this.assertDeletion({
            pullRequestLineNumber: 2,
            lineNumber: 2
        });
    }

    @test
    testDeletion_3_to_0(): void {
        this.assertDeletion({
            pullRequestLineNumber: 3,
            lineNumber: 0
        });
    }

    @test
    testDeletion_4_to_3(): void {
        this.assertDeletion({
            pullRequestLineNumber: 4,
            lineNumber: 3
        });
    }

    @test
    testDeletion_5_to_0(): void {
        this.assertDeletion({
            pullRequestLineNumber: 5,
            lineNumber: 0
        });
    }

    @test
    testDeletion_6_to_4(): void {
        this.assertDeletion({
            pullRequestLineNumber: 6,
            lineNumber: 4
        });
    }

    /**
     * var original = ['line1', 'line2', 'new line', 'line3', 'another new line', 'line4'];
     * var modified = ['line1', 'line2', 'line3', 'line4'];
     */
    protected assertDeletion(options: {
        pullRequestLineNumber: number,
        lineNumber: number
    }): void {
        const changes = [this.createLineDeletion(3, 3, 2), this.createLineDeletion(5, 5, 3)];
        this.assertMapping({
            ...options,
            changes
        });
    }

    protected assertMapping(options: {
        pullRequestLineNumber: number,
        lineNumber: number,
        changes: monaco.services.IChange[]
    }): void {
        const { pullRequestLineNumber, lineNumber, changes } = options;
        const mapper = new GitHubEditorLineMapper({
            changes,
            onChanged: Event.None
        });

        const expectedPullRequestLineNumber = lineNumber === 0 ? 0 : pullRequestLineNumber;
        assert.equal(expectedPullRequestLineNumber, mapper.mapToPullRequest(lineNumber),
            `mapToPullRequest(${lineNumber}) === ${expectedPullRequestLineNumber}`);

        const expectedLineNumber = pullRequestLineNumber === 0 ? 0 : lineNumber;
        assert.equal(expectedLineNumber, mapper.mapToChanges(pullRequestLineNumber),
            `mapToChanges(${pullRequestLineNumber}) === ${expectedLineNumber}`);
    }

    protected createLineDeletion(startLineNumber: number, endLineNumber: number, modifiedLineNumber: number): monaco.services.IChange {
        return {
            originalStartLineNumber: startLineNumber,
            originalEndLineNumber: endLineNumber,
            modifiedStartLineNumber: modifiedLineNumber,
            modifiedEndLineNumber: 0
        };
    }

    protected createLineInsertion(startLineNumber: number, endLineNumber: number, originalLineNumber: number): monaco.services.IChange {
        return {
            originalStartLineNumber: originalLineNumber,
            originalEndLineNumber: 0,
            modifiedStartLineNumber: startLineNumber,
            modifiedEndLineNumber: endLineNumber
        };
    }

    protected createLineChange(originalStartLineNumber: number, originalEndLineNumber: number, modifiedStartLineNumber: number, modifiedEndLineNumber: number): monaco.services.IChange {
        return {
            originalStartLineNumber: originalStartLineNumber,
            originalEndLineNumber: originalEndLineNumber,
            modifiedStartLineNumber: modifiedStartLineNumber,
            modifiedEndLineNumber: modifiedEndLineNumber
        };
    }

}
