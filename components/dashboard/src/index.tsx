/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { UserContextProvider } from './user-context';
import { AdminContextProvider } from './admin-context';
import { TeamsContextProvider } from './teams/teams-context';
import { ProjectContextProvider } from './projects/project-context';
import { ThemeContextProvider } from './theme-context';
import { StartWorkspaceModalContextProvider } from './workspaces/start-workspace-modal-context';
import { BrowserRouter } from 'react-router-dom';

import "./index.css"

ReactDOM.render(
    <React.StrictMode>
        <UserContextProvider>
            <AdminContextProvider>
                <TeamsContextProvider>
                    <ProjectContextProvider>
                        <ThemeContextProvider>
                            <StartWorkspaceModalContextProvider>
                                <BrowserRouter>
                                    <App />
                                </BrowserRouter>
                            </StartWorkspaceModalContextProvider>
                        </ThemeContextProvider>
                    </ProjectContextProvider>
                </TeamsContextProvider>
            </AdminContextProvider>
        </UserContextProvider>
    </React.StrictMode>,
    document.getElementById('root')
);