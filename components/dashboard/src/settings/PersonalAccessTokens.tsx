/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useContext } from "react";
import { Redirect } from "react-router";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";

function PersonalAccessTokens() {
    const { enablePersonalAccessTokens } = useContext(FeatureFlagContext);

    if (!enablePersonalAccessTokens) {
        return <Redirect to="/" />;
    }

    return (
        <div>
            <PageWithSettingsSubMenu
                title="Preferences"
                subtitle="Manage your Personal Access Tokens to access the Gitpod API."
                children={undefined}
            ></PageWithSettingsSubMenu>
        </div>
    );
}

export default PersonalAccessTokens;
