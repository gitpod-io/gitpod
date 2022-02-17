// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public class RemoteTrackMessage {
    private String event;
    private Object properties;

    public String getEvent() {
        return event;
    }

    public void setEvent(String event) {
        this.event = event;
    }

    public Object getProperties() {
        return properties;
    }

    public void setProperties(Object properties) {
        this.properties = properties;
    }

    @Override
    public String toString() {
        return "RemoteTrackMessage{" +
                "event='" + event + '\'' +
                ", properties=" + properties +
                '}';
    }
}
