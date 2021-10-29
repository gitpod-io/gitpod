// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public class SendHeartBeatOptions {

    private final String instanceId;
    private final Boolean wasClosed;
    private final Integer roundTripTime;

    public SendHeartBeatOptions(final String instanceId) {
        this.instanceId = instanceId;
        this.wasClosed = null;
        this.roundTripTime = null;
    }

    public SendHeartBeatOptions(final String instanceId, final Boolean wasClosed, final Integer roundTripTime) {
        this.instanceId = instanceId;
        this.wasClosed = wasClosed;
        this.roundTripTime = roundTripTime;
    }

    public SendHeartBeatOptions(final String instanceId, final Boolean wasClosed) {
        this.instanceId = instanceId;
        this.wasClosed = wasClosed;
        this.roundTripTime = null;
    }

    public String getInstanceId() {
        return instanceId;
    }

    public Boolean isWasClosed() {
        return wasClosed;
    }

    public Integer getRoundTripTime() {
        return roundTripTime;
    }

    @Override
    public int hashCode() {
        final Integer prime = 31;
        Integer result = 1;
        result = prime * result + ((instanceId == null) ? 0 : instanceId.hashCode());
        result = prime * result + roundTripTime;
        result = prime * result + (wasClosed ? 1231 : 1237);
        return result;
    }

    @Override
    public boolean equals(final Object obj) {
        if (this == obj)
            return true;
        if (obj == null)
            return false;
        if (getClass() != obj.getClass())
            return false;
        final SendHeartBeatOptions other = (SendHeartBeatOptions) obj;
        if (instanceId == null) {
            if (other.instanceId != null)
                return false;
        } else if (!instanceId.equals(other.instanceId))
            return false;
        if (roundTripTime != other.roundTripTime)
            return false;
        if (wasClosed != other.wasClosed)
            return false;
        return true;
    }

    @Override
    public String toString() {
        return "SendHeartBeatOptions [instanceId=" + instanceId + ", roundTripTime=" + roundTripTime + ", wasClosed="
                + wasClosed + "]";
    }
}
