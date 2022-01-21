/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { suite, test } from 'mocha-typescript';
import * as chai from 'chai';
import { SnapshotUrl } from '.';

const expect = chai.expect;

@suite
class TestSnapshotUrlParser {
  @test public testPositive() {
    const actual = SnapshotUrl.parse(
      'workspaces/c362d434-6faa-4ce0-9ad4-91b4a87c4abe/3f0556f7-4afa-11e9-98d5-52f8983b9279.tar@gitpod-prodcopy-user-e1e28f18-0354-4a5d-b6b4-8879a2ff73fd',
    );

    expect(actual).to.deep.equal(<SnapshotUrl>{
      bucketId: 'gitpod-prodcopy-user-e1e28f18-0354-4a5d-b6b4-8879a2ff73fd',
      filename: '3f0556f7-4afa-11e9-98d5-52f8983b9279.tar',
      fullPath: 'workspaces/c362d434-6faa-4ce0-9ad4-91b4a87c4abe/3f0556f7-4afa-11e9-98d5-52f8983b9279.tar',
    });
  }
}
module.exports = new TestSnapshotUrlParser(); // Only to circumvent no usage warning :-/
