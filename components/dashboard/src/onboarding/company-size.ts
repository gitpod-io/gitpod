/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const getCompanySizeOptions = () => {
    return [
        { label: "Please select one", value: "" },
        { label: "less than 50", value: "less_than_50" },
        { label: "51 - 250", value: "51_to_250" },
        { label: "251 - 1000", value: "251_to_1000" },
        { label: "more than 1000", value: "more_than_1000" },
    ];
};
