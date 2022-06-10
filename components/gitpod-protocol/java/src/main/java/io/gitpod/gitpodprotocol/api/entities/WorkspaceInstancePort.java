// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public class WorkspaceInstancePort {
    private Number port;
    private String visibility;
    private String url;

    public void setPort(Number port) {
        this.port = port;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public Number getPort() { return this.port; }

    public String getVisibility() { return this.visibility; }

    public String getUrl() { return this.url; }
}
