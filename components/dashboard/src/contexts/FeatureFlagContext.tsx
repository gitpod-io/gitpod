/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { getExperimentsClient } from "../experiments/client";
import { UserContext } from "../user-context";

const FeatureFlagContext = createContext<{
    isBlockedRepositoriesUIEnabled: boolean;
    setIsBlockedRepositoriesUIEnabled: React.Dispatch<boolean>;
}>({
    isBlockedRepositoriesUIEnabled: false,
    setIsBlockedRepositoriesUIEnabled: () => {},
});

const FeatureFlagContextProvider: React.FC = ({ children }) => {
    const [isBlockedRepositoriesUIEnabled, setIsBlockedRepositoriesUIEnabled] = useState(false);
    const { user } = useContext(UserContext);

    useEffect(() => {
        (async () => {
            const isBlockedRepositoriesUIEnabled = await getExperimentsClient().getValueAsync(
                "isblockedrepositoriesuienabled",
                false,
                { user },
            );
            setIsBlockedRepositoriesUIEnabled(isBlockedRepositoriesUIEnabled);
        })();
    }, [user]);

    return (
        <FeatureFlagContext.Provider
            value={{
                isBlockedRepositoriesUIEnabled,
                setIsBlockedRepositoriesUIEnabled,
            }}
        >
            {children}
        </FeatureFlagContext.Provider>
    );
};

export { FeatureFlagContext, FeatureFlagContextProvider };
