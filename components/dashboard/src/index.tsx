/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import * as GitpodCookie from "@gitpod/gitpod-protocol/lib/util/gitpod-cookie";
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
import { getURLHash, isGitpodIo } from "./utils";
import { isWebsiteSlug } from "./utils";

import "./index.css";

const bootApp = () => {
    // Handle any boot logic prior to rendering app

    // gitpod.io specific boot logic
    if (isGitpodIo()) {
        // Redirect to www website for any website slugs
        if (isWebsiteSlug(window.location.pathname)) {
            window.location.host = "www.gitpod.io";
            return;
        }

        // Redirect to www website if it's the root url and no cookie
        if (window.location.pathname === "/" && window.location.hash === "") {
            // If there's no gp cookie, bounce to www site
            if (!GitpodCookie.isPresent(document.cookie)) {
                window.location.href = `https://www.gitpod.io`;
                return;
            }
        }
    }

    // Normalize github.dev urls to github.com
    const hash = getURLHash();
    if (/^(https:\/\/)?github\.dev\//i.test(hash)) {
        window.location.hash = hash.replace(/^(https:\/\/)?github\.dev\//i, "https://github.com/");
    } else if (/^([^/]+?=[^/]*?|prebuild)\/(https:\/\/)?github\.dev\//i.test(hash)) {
        window.location.hash = hash.replace(
            /^([^/]+?=[^/]*?|prebuild)\/(https:\/\/)?github\.dev\//i,
            "$1/https://github.com/",
        );
    }

    // Configure libraries
    dayjs.extend(relativeTime);
    dayjs.extend(utc);

    // Render the App
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
};

bootApp();
