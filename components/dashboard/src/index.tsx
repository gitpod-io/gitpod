/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { UserContextProvider } from "./user-context";
import { AdminContextProvider } from "./admin-context";
import { PaymentContextProvider } from "./payment-context";
import { LicenseContextProvider } from "./license-context";
import { TeamsContextProvider } from "./teams/teams-context";
import { ProjectContextProvider } from "./projects/project-context";
import { ThemeContextProvider } from "./theme-context";
import { FeatureFlagContextProvider } from "./contexts/FeatureFlagContext";
import { StartWorkspaceModalContextProvider } from "./workspaces/start-workspace-modal-context";
import { BrowserRouter } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

import "./index.css";

dayjs.extend(relativeTime);
dayjs.extend(utc);

ReactDOM.render(
    <React.StrictMode>
        <UserContextProvider>
            <AdminContextProvider>
                <PaymentContextProvider>
                    <LicenseContextProvider>
                        <TeamsContextProvider>
                            <ProjectContextProvider>
                                <ThemeContextProvider>
                                    <StartWorkspaceModalContextProvider>
                                        <BrowserRouter>
                                            <FeatureFlagContextProvider>
                                                <App />
                                            </FeatureFlagContextProvider>
                                        </BrowserRouter>
                                    </StartWorkspaceModalContextProvider>
                                </ThemeContextProvider>
                            </ProjectContextProvider>
                        </TeamsContextProvider>
                    </LicenseContextProvider>
                </PaymentContextProvider>
            </AdminContextProvider>
        </UserContextProvider>
    </React.StrictMode>,
    document.getElementById("root"),
);
