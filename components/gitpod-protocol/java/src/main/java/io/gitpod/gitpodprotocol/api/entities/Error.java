// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public enum Error {
    NOT_FOUND(404),
    SNAPSHOT_ERROR(630);

    private int errCode;

    Error(int errCode) {
        this.errCode = errCode;
    }

    public int getErrCode() {
        return errCode;
    }
}
