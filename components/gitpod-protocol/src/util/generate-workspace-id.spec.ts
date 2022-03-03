/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { suite, test } from 'mocha-typescript';
import * as chai from 'chai';
import { generateWorkspaceID, colors, animals } from './generate-workspace-id';
import { GitpodHostUrl } from './gitpod-host-url';

const expect = chai.expect;

@suite
class TestGenerateWorkspaceId {
    @test public async testGenerateWorkspaceId() {
        for (let i = 0; i < 100; i++) {
            const id = await generateWorkspaceID();
            expect(new GitpodHostUrl().withWorkspacePrefix(id, 'eu').workspaceId).to.equal(id);
        }
    }

    @test public testLongestName() {
        const longestColor = colors.sort((a, b) => b.length - a.length)[0];
        const longestAnimal = animals.sort((a, b) => b.length - a.length)[0];
        const longestName = `${longestColor}-${longestAnimal}-12345678`;
        expect(longestName.length <= 36, `"${longestName}" is longer than 36 chars (${longestName.length})`).to.be.true;
    }

    @test public async testCustomName() {
        const data = [
            ['foo', 'bar', 'foo-bar-'],
            ['f', 'bar', '.{2,16}-bar-'],
            ['gitpod-io', 'gitpod', 'gitpodio-gitpod-'],
            [
                'this is rather long and has some "§$"% special chars',
                'also here pretty long and needs abbreviation',
                'thisisratherlon-alsohere-',
            ],
            ['breatheco-de', 'python-flask-api-tutorial', 'breathecode-pythonflaska-'],
            ['UPPER', 'CaSe', 'upper-case-'],
        ];
        for (const d of data) {
            const id = await generateWorkspaceID(d[0], d[1]);
            expect(id).match(new RegExp('^' + d[2]));
            expect(new GitpodHostUrl().withWorkspacePrefix(id, 'eu').workspaceId).to.equal(id);
            expect(id.length <= 36, `"${id}" is longer than 36 chars (${id.length})`).to.be.true;
        }
    }
}
module.exports = new TestGenerateWorkspaceId();
