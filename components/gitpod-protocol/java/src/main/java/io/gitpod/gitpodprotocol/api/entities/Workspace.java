// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public class Workspace {

    private String id;

    private String contextURL;

    private WorkspaceContext context;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getContextURL() {
        return contextURL;
    }

    public void setContextURL(String contextURL) {
        this.contextURL = contextURL;
    }

    public WorkspaceContext getContext() {
        return context;
    }

    public void setContext(WorkspaceContext context) {
        this.context = context;
    }
}
