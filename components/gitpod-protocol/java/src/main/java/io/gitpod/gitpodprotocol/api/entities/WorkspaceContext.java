// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package io.gitpod.gitpodprotocol.api.entities;

import java.util.Optional;

public class WorkspaceContext {
    private String normalizedContextURL;
    private String ref;

    public Optional<String> getNormalizedContextURL() {
        return Optional.ofNullable(normalizedContextURL);
    }

    public void setNormalizedContextURL(String normalizedContextURL) {
        this.normalizedContextURL = normalizedContextURL;
    }

    public Optional<String> getRef() {
        return Optional.ofNullable(ref);
    }

    public void setRef(String ref) {
        this.ref = ref;
    }
}
