/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { createContext, useContext, useEffect } from "react";
import { UserContext } from "../user-context";

const FeatureFlagContext = createContext({});

const FeatureFlagContextProvider: React.FC = ({ children }) => {
    const { user } = useContext(UserContext);

    useEffect(() => {
        // Query FeatureFlag here
    }, [user]);

    return <FeatureFlagContext.Provider value={{}}>{children}</FeatureFlagContext.Provider>;
};

export { FeatureFlagContext, FeatureFlagContextProvider };
