/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */
export const EXPLORE_REASON_WORK = "explore-professional";

export const getExplorationReasons = () => {
    return [
        { value: EXPLORE_REASON_WORK, label: "Work" },
        { value: "explore-personal", label: "Personal projects or open-source development" },
        {
            value: "replace-remote-dev",
            label: "Replacing remote or containerized development (i.e. VDI, VM, Docker Desktop)",
        },
    ];
};
