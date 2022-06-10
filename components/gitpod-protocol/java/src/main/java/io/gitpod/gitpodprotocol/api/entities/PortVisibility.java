// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

public enum PortVisibility {
    PUBLIC("public"), PRIVATE("private");

    private final String toString;

    private PortVisibility(String toString) {
        this.toString = toString;
    }

    public String toString() {
        return toString;
    }
}
