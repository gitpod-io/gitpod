// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public class Repository {

    private String branch;
    private int totalUncommitedFiles;
    private int totalUnpushedCommits;
    private int totalUntrackedFiles;

    public String getBranch() {
        return branch;
    }

    public void setBranch(String branch) {
        this.branch = branch;
    }

    public int getTotalUncommitedFiles() {
        return totalUncommitedFiles;
    }

    public void setTotalUncommitedFiles(int totalUncommitedFiles) {
        this.totalUncommitedFiles = totalUncommitedFiles;
    }

    public int getTotalUnpushedCommits() {
        return totalUnpushedCommits;
    }

    public void setTotalUnpushedCommits(int totalUnpushedCommits) {
        this.totalUnpushedCommits = totalUnpushedCommits;
    }

    public int getTotalUntrackedFiles() {
        return totalUntrackedFiles;
    }

    public void setTotalUntrackedFiles(int totalUntrackedFiles) {
        this.totalUntrackedFiles = totalUntrackedFiles;
    }
}
