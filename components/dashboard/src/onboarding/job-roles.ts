/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const JOB_ROLE_OTHER = "other";

export const getJobRoleOptions = () => {
    return [
        { value: "", label: "Please select one" },
        { value: "software-eng", label: "Software Engineer" },
        { value: "data", label: "Data / Analytics" },
        { value: "academics", label: "Academic (Student, Researcher)" },
        { value: "enabling", label: "Enabling team (Platform, Developer Experience)" },
        { value: "team-lead", label: "Team / Function Lead" },
        { value: "devrel", label: "DevRel" },
        { value: "product-design", label: "Product (PM, Designer)" },
        { value: JOB_ROLE_OTHER, label: "Other - please specify / prefer not to say" },
    ];
};
