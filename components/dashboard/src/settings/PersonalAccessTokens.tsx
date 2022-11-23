/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { PersonalAccessToken } from "@gitpod/public-api/lib/gitpod/experimental/v1/tokens_pb";
import { useContext, useEffect, useState } from "react";
import { Redirect } from "react-router";
import { FeatureFlagContext } from "../contexts/FeatureFlagContext";
import { personalAccessTokensService } from "../service/public-api";
import { PageWithSettingsSubMenu } from "./PageWithSettingsSubMenu";

function PersonalAccessTokens() {
    const { enablePersonalAccessTokens } = useContext(FeatureFlagContext);

    if (!enablePersonalAccessTokens) {
        return <Redirect to="/" />;
    }

    return (
        <div>
            <PageWithSettingsSubMenu title="Access Tokens" subtitle="Manage your personal access tokens.">
                <ListAccessTokensView />
            </PageWithSettingsSubMenu>
        </div>
    );
}

function ListAccessTokensView() {
    const [tokens, setTokens] = useState<PersonalAccessToken[]>([]);

    useEffect(() => {
        (async () => {
            const response = await personalAccessTokensService.listPersonalAccessTokens({});
            setTokens(response.tokens);
        })();
    }, []);

    return (
        <div>
            <ul>
                {tokens.map((t: PersonalAccessToken) => {
                    return (
                        <li>
                            {t.id} - {t.name} - {t.value}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default PersonalAccessTokens;
