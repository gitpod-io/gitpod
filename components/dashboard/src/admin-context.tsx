/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { createContext, useState } from 'react';
import { InstallationAdminSettings } from '@gitpod/gitpod-protocol';

const AdminContext = createContext<{
    adminSettings?: InstallationAdminSettings;
    setAdminSettings: React.Dispatch<InstallationAdminSettings>;
}>({
    setAdminSettings: () => null,
});

const AdminContextProvider: React.FC = ({ children }) => {
    const [adminSettings, setAdminSettings] = useState<InstallationAdminSettings>();
    return <AdminContext.Provider value={{ adminSettings, setAdminSettings }}>{children}</AdminContext.Provider>;
};

export { AdminContext, AdminContextProvider };
