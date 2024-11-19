/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

export const SIGNUP_GOALS_OTHER = "other";

export const getSignupGoalsOptions = () => {
    return [
        { value: "onboarding", label: "Faster onboarding" },
        { value: "efficiency-collab", label: "Improve developer efficiency and collaboration" },
        { value: "powerful-resources", label: "More powerful development resources" },
        { value: "security", label: "More secure development process" },
        { value: SIGNUP_GOALS_OTHER, label: "Other" },
    ];
};
