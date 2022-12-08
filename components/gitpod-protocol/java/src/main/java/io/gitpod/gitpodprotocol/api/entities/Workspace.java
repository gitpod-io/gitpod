// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public class Workspace {

    private String id;

    private String contextURL;

    private WorkspaceContext context;

    private String creationTime;

    private String type;

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

    public String getCreationTime() {
        return creationTime;
    }

    public void setCreationTime(String creationTime) {
        this.creationTime = creationTime;
    }

    public WorkspaceType getType() {
        return WorkspaceType.valueOf(type);
    }

    public void setType(WorkspaceType type) {
        this.type = type.toString();
    }
}
