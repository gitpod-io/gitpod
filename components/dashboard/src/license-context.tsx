/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { createContext, useState } from "react";
import { LicenseInfo } from "@gitpod/gitpod-protocol";

const LicenseContext = createContext<{
    license?: LicenseInfo;
    setLicense: React.Dispatch<LicenseInfo>;
}>({
    setLicense: () => null,
});

const LicenseContextProvider: React.FC = ({ children }) => {
    const [license, setLicense] = useState<LicenseInfo>();
    return <LicenseContext.Provider value={{ license, setLicense }}>{children}</LicenseContext.Provider>;
};

export { LicenseContext, LicenseContextProvider };
