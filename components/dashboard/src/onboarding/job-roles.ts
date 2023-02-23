/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const JOB_ROLE_OTHER = "other";

export const getJobRoleOptions = () => {
    return [
        { label: "Please select one", value: "" },
        { label: "Backend", value: "backend" },
        { label: "Frontend", value: "frontend" },
        { label: "Full Stack", value: "fullstack" },
        { label: "Data / analytics", value: "data_analytics" },
        { label: "DevOps / devX / platform", value: "devops_devx_platform" },
        { label: "Product / design", value: "product_design" },
        { label: "Customer engineering", value: "customer_engineering" },
        { label: "DevRel", value: "devrel" },
        { label: "Open source", value: "open_source" },
        { label: "Academia / student", value: "academia" },
        { label: "Other / prefer not to say", value: JOB_ROLE_OTHER },
    ];
};
