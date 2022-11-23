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
        <>
            <div className="flex items-start sm:justify-between mb-2">
                <div>
                    <h3>Personal Access Tokens</h3>
                    <h2 className="text-gray-500">Create or regenerate active personal access tokens.</h2>
                </div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-xl w-full py-28 flex flex-col items-center">
                <h3 className="text-center pb-3 text-gray-500 dark:text-gray-400">No Personal Access Tokens (PAT)</h3>
                <p className="text-center pb-6 text-gray-500 text-base w-96">
                    Generate a personal access token (PAT) for applications that need access to the Gitpod API.{" "}
                </p>
                <button>New Personal Access Token</button>
            </div>
            {tokens.length > 0 && (
                <ul>
                    {tokens.map((t: PersonalAccessToken) => {
                        return (
                            <li>
                                {t.id} - {t.name} - {t.value}
                            </li>
                        );
                    })}
                </ul>
            )}
        </>
    );
}

export default PersonalAccessTokens;
