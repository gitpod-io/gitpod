/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const SIGNUP_GOALS_OTHER = "other";

export const getSignupGoalsOptions = () => {
    return [
        {
            label: "Replace remote/containerized development (VDI, VM based, Docker Desktop..)",
            value: "replace_remote_containerized_dev",
        },
        { label: "More powerful dev resources", value: "powerful_dev_resources" },
        { label: "Just exploring CDEs", value: "exploring_cdes" },
        { label: "Faster onboarding", value: "faster_onboarding" },
        { label: "More secure dev process", value: "secure_dev_process" },
        { label: "Dev efficiency & collaboration", value: "dev_efficiency_collaboration" },
        { label: "Contribute to open source", value: "open_source" },
        { label: "Work from any device (iPad,…)", value: "work_from_any_device" },
        { label: `Solve "works on my machine issue"`, value: "works_on_my_machine" },
        { label: "Work on hobby projects", value: "hobby" },
        { label: "Other / prefer not to say", value: SIGNUP_GOALS_OTHER },
    ];
};
