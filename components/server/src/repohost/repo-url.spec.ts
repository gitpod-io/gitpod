/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import * as chai from 'chai';
import { suite, test } from 'mocha-typescript';
import { RepoURL } from './repo-url';

const expect = chai.expect;

@suite
export class RepoUrlTest {
  @test public parseRepoUrl() {
    const testUrl = RepoURL.parseRepoUrl('https://gitlab.com/hello-group/my-cool-project.git');
    expect(testUrl).to.deep.equal({
      host: 'gitlab.com',
      owner: 'hello-group',
      repo: 'my-cool-project',
    });
  }

  @test public parseSubgroupOneLevel() {
    const testUrl = RepoURL.parseRepoUrl('https://gitlab.com/hello-group/my-subgroup/my-cool-project.git');
    expect(testUrl).to.deep.equal({
      host: 'gitlab.com',
      owner: 'hello-group/my-subgroup',
      repo: 'my-cool-project',
    });
  }

  @test public parseSubgroupTwoLevels() {
    const testUrl = RepoURL.parseRepoUrl(
      'https://gitlab.com/hello-group/my-subgroup/my-sub-subgroup/my-cool-project.git',
    );
    expect(testUrl).to.deep.equal({
      host: 'gitlab.com',
      owner: 'hello-group/my-subgroup/my-sub-subgroup',
      repo: 'my-cool-project',
    });
  }

  @test public parseSubgroupThreeLevels() {
    const testUrl = RepoURL.parseRepoUrl(
      'https://gitlab.com/hello-group/my-subgroup/my-sub-subgroup/my-sub-sub-subgroup/my-cool-project.git',
    );
    expect(testUrl).to.deep.equal({
      host: 'gitlab.com',
      owner: 'hello-group/my-subgroup/my-sub-subgroup/my-sub-sub-subgroup',
      repo: 'my-cool-project',
    });
  }

  @test public parseSubgroupFourLevels() {
    const testUrl = RepoURL.parseRepoUrl(
      'https://gitlab.com/hello-group/my-subgroup/my-sub-subgroup/my-sub-sub-subgroup/my-sub-sub-sub-subgroup/my-cool-project.git',
    );
    expect(testUrl).to.deep.equal({
      host: 'gitlab.com',
      owner: 'hello-group/my-subgroup/my-sub-subgroup/my-sub-sub-subgroup/my-sub-sub-sub-subgroup',
      repo: 'my-cool-project',
    });
  }
}

module.exports = new RepoUrlTest();
