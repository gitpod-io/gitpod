/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as assert from 'assert';
import { suite, test } from "mocha-typescript"
import { NewPullRequestContent } from './new-pull-request-content';

@suite
export class NewPullRequestContentTest {

    @test
    parse_01(): void {
        const expectedTitle = new Array(NewPullRequestContent.maxLineLength + 1).join('a');
        const { title, body } = NewPullRequestContent.parse(expectedTitle + NewPullRequestContent.lineDelimiter + 'body   ');
        assert.equal(title, expectedTitle);
        assert.equal(body, 'body');
    }

    @test
    parse_02(): void {
        const expectedTitle = new Array(NewPullRequestContent.maxLineLength + 1).join('a');
        const { title, body } = NewPullRequestContent.parse(expectedTitle + 'a' + NewPullRequestContent.lineDelimiter + 'body   ');
        assert.equal(title, expectedTitle + '...');
        assert.equal(body, 'a' + NewPullRequestContent.lineDelimiter + 'body');
    }

    @test
    parse_03(): void {
        const expectedTitle = new Array(NewPullRequestContent.maxLineLength - 10).join('a');
        const { title, body } = NewPullRequestContent.parse(expectedTitle + NewPullRequestContent.lineDelimiter + 'body   ');
        assert.equal(title, expectedTitle);
        assert.equal(body, 'body');
    }

}
