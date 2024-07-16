/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const JOB_ROLE_OTHER = "other";

export const getJobRoleOptions = () => {
    return [
        { value: "", label: "Please select one" },
        { value: "software-eng", label: "Software Engineering" },
        { value: "data", label: "Data / Analytics" },
        { value: "academics", label: "Academia (Student, Researcher)" },
        { value: "enabling", label: "DevOps / Platform / DevX" },
        { value: "team-lead", label: "A Team Lead or Function Lead role" },
        { value: "devrel", label: "DevRel" },
        { value: "product-design", label: "Product" },
        { value: JOB_ROLE_OTHER, label: "Other" },
    ];
};
