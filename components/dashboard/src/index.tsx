/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// this should stay at the top to enable monitoring as soon as possible
import "./service/metrics";

import "setimmediate"; // important!, required by vscode-jsonrpc
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";
import { RootAppRouter } from "./App";
import { QueryErrorBoundary } from "./components/error-boundaries/QueryErrorBoundary";
import { ReloadPageErrorBoundary } from "./components/error-boundaries/ReloadPageErrorBoundary";
import { ToastContextProvider } from "./components/toasts/Toasts";
import { ConfettiContextProvider } from "./contexts/ConfettiContext";
import { setupQueryClientProvider } from "./data/setup";
import "./index.css";
import { PaymentContextProvider } from "./payment-context";
import { ThemeContextProvider } from "./theme-context";
import { UserContextProvider } from "./user-context";
import { getURLHash, isGitpodIo, isWebsiteSlug } from "./utils";
import { getExperimentsClient } from "./experiments/client";
// Import the minimal login HTML template at build time
import minimalLoginHtml from "./minimal-login.html";

const MINIMAL_MODE_STORAGE_KEY = "minimal_gitpod_io_mode";
const MINIMAL_MODE_FLAG_NAME = "minimal_gitpod_io_mode";

/**
 * Check if we should use minimal gitpod.io mode.
 * Priority:
 * 1. localStorage override (for testing)
 * 2. ConfigCat feature flag
 */
async function shouldUseMinimalMode(): Promise<boolean> {
    // Check localStorage override first (sync, for testing)
    try {
        const localOverride = localStorage.getItem(MINIMAL_MODE_STORAGE_KEY);
        if (localOverride === "true") return true;
        if (localOverride === "false") return false;
    } catch {
        // localStorage might not be available
    }

    // Check ConfigCat feature flag
    try {
        const client = getExperimentsClient();
        const value = await client.getValueAsync(MINIMAL_MODE_FLAG_NAME, false, {
            gitpodHost: window.location.host,
        });
        return value === true;
    } catch (error) {
        console.error("Failed to check minimal mode flag:", error);
        return false; // Fail safe: use full app
    }
}

/**
 * Check if the pathname is a known app route that should show the minimal login page
 */
function isAppRoute(pathname: string): boolean {
    const appRoutes = [
        "/workspaces",
        "/new",
        "/start",
        "/settings",
        "/billing",
        "/members",
        "/sso",
        "/orgs",
        "/repositories",
        "/prebuilds",
        "/admin",
        "/login",
        "/oauth-approval",
        "/blocked",
        "/from-referrer",
        "/usage",
        "/insights",
        "/org-admin",
        "/quickstart",
        // Legacy routes that redirect in full app
        "/account",
        "/integrations",
        "/notifications",
        "/preferences",
        "/variables",
        "/tokens",
        "/keys",
        "/open",
        "/sorry",
        "/t/",
        "/projects/",
        "/user/",
        "/access-control",
        "/old-team-plans",
        "/teams",
        "/subscription",
        "/upgrade-subscription",
        "/plans",
    ];

    return appRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

/**
 * Handle requests in minimal gitpod.io mode.
 * This runs instead of the full React app when minimal mode is enabled.
 */
function handleMinimalGitpodIoMode(): void {
    const pathname = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;
    const hashContent = hash.replace(/^#\/?/, "");

    // 1. Website slugs -> www.gitpod.io
    if (isWebsiteSlug(pathname)) {
        window.location.href = `https://www.gitpod.io${pathname}${search}`;
        return;
    }

    // 2. Hash-based workspace creation -> app.ona.com
    if (hashContent !== "") {
        // Normalize github.dev to github.com first
        let normalizedHash = hash;
        if (/^#\/?((https:\/\/)?github\.dev\/)/i.test(hash)) {
            normalizedHash = hash.replace(/github\.dev\//gi, "github.com/");
        }
        window.location.href = `https://app.ona.com/${normalizedHash}`;
        return;
    }

    // 3. Legacy URL formats (/github.com/..., /gitlab.com/..., /bitbucket.org/...)
    if (/^\/(github|gitlab|bitbucket)\.(com|org)\//.test(pathname)) {
        window.location.href = `https://app.ona.com/#${pathname.slice(1)}${search}`;
        return;
    }

    // 4. App routes -> render minimal login page
    if (isAppRoute(pathname)) {
        renderMinimalLoginPage();
        return;
    }

    // 5. Root path -> render minimal login page
    if (pathname === "/" || pathname === "") {
        renderMinimalLoginPage();
        return;
    }

    // 6. Unknown paths -> www.gitpod.io (let website handle 404)
    window.location.href = `https://www.gitpod.io${pathname}${search}`;
}

/**
 * Render a minimal static login page without React.
 * Loads the HTML from an external file for easier review and maintenance.
 */
function renderMinimalLoginPage(): void {
    // Replace the entire document with the minimal login page
    document.open();
    document.write(minimalLoginHtml);
    document.close();
}

/**
 * Boot the full React application
 */
function bootFullApp(): void {
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

    const GitpodQueryClientProvider = setupQueryClientProvider();

    // Configure libraries
    dayjs.extend(relativeTime);
    dayjs.extend(utc);
    dayjs.extend(duration);

    // Render the App
    ReactDOM.render(
        <React.StrictMode>
            <ThemeContextProvider>
                <ReloadPageErrorBoundary>
                    <BrowserRouter>
                        <GitpodQueryClientProvider>
                            {/* This needs to be inside of the GitpodQueryClientProvider so it can reset queries if needed */}
                            <QueryErrorBoundary>
                                <ConfettiContextProvider>
                                    <ToastContextProvider>
                                        <UserContextProvider>
                                            <PaymentContextProvider>
                                                <RootAppRouter />
                                            </PaymentContextProvider>
                                        </UserContextProvider>
                                    </ToastContextProvider>
                                </ConfettiContextProvider>
                            </QueryErrorBoundary>
                        </GitpodQueryClientProvider>
                    </BrowserRouter>
                </ReloadPageErrorBoundary>
            </ThemeContextProvider>
        </React.StrictMode>,
        document.getElementById("root"),
    );
}

/**
 * Main boot function
 */
const bootApp = async () => {
    // Minimal gitpod.io mode - only on exact "gitpod.io" domain
    if (isGitpodIo()) {
        const minimalMode = await shouldUseMinimalMode();

        if (minimalMode) {
            handleMinimalGitpodIoMode();
            return;
        }

        // Not in minimal mode, but still handle website slugs
        if (isWebsiteSlug(window.location.pathname)) {
            window.location.host = "www.gitpod.io";
            return;
        }
    }

    // Boot full React app
    bootFullApp();
};

bootApp();
