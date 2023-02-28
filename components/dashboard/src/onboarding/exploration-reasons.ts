/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
export const EXPLORE_REASON_WORK = "explore-professional";

export const getExplorationReasons = () => {
    return [
        { value: EXPLORE_REASON_WORK, label: "For work" },
        { value: "explore-personal", label: "For personal projects or open-source" },
        {
            value: "replace-remote-dev",
            label: "To replace remote/containerized development (VDI, VM, Docker Desktop)",
        },
    ];
};
