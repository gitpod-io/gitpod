// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public class WorkspaceContext {
    private String normalizedContextURL;

    public String getNormalizedContextURL() {
        return normalizedContextURL;
    }

    public void setNormalizedContextURL(String normalizedContextURL) {
        this.normalizedContextURL = normalizedContextURL;
    }
}
