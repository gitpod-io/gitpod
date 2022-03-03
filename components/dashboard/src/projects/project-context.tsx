/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */
/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { Project } from '@gitpod/gitpod-protocol';
import React, { createContext, useState } from 'react';

export const ProjectContext = createContext<{
    project?: Project;
    setProject: React.Dispatch<Project>;
}>({
    setProject: () => null,
});

export const ProjectContextProvider: React.FC = ({ children }) => {
    const [project, setProject] = useState<Project>();
    return <ProjectContext.Provider value={{ project, setProject }}>{children}</ProjectContext.Provider>;
};
