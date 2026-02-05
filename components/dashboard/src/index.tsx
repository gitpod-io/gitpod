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
import { getURLHash, isWebsiteSlug } from "./utils";
// Import the minimal login HTML template at build time
import minimalLoginHtml from "./minimal-login.html";

const MINIMAL_MODE_OVERRIDE_KEY = "minimal_gitpod_io_mode";

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
 * Extract body content from a full HTML document string.
 * This allows keeping the complete HTML structure in the source file for easier editing.
 */
function extractBodyContent(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return doc.body.innerHTML;
}

/**
 * Render a minimal static login page without React.
 * Uses innerHTML instead of document.write() to avoid deprecation issues.
 */
function renderMinimalLoginPage(): void {
    const bodyContent = extractBodyContent(minimalLoginHtml);
    const root = document.getElementById("root");
    if (root) {
        root.innerHTML = bodyContent;
    } else {
        // Fallback if root doesn't exist
        document.body.innerHTML = bodyContent;
    }
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
 * Check if this is exactlly gitpod.io
 */
function isExactGitpodIo(): boolean {
    return window.location.hostname === "gitpod.io";
}

/**
 * Main boot function
 *
 * Minimal mode is enabled when:
 * - localStorage override is "true" (for testing in preview environments)
 * - Host is exactly "gitpod.io" AND path is not a website slug
 */
const bootApp = () => {
    let minimalMode = false;

    // Handle website slugs on gitpod.io - redirect to www.gitpod.io
    if (isExactGitpodIo()) {
        const pathname = window.location.pathname;
        if (isWebsiteSlug(pathname)) {
            window.location.href = `https://www.gitpod.io${pathname}${window.location.search}`;
            return;
        }
        minimalMode = true;
    }

    // Check local storage override
    try {
        if (localStorage.getItem(MINIMAL_MODE_OVERRIDE_KEY) === "true") {
            minimalMode = true;
        }
    } catch {
        // localStorage might not be available
    }

    if (minimalMode) {
        handleMinimalGitpodIoMode();
        return;
    }

    // Boot full React app
    bootFullApp();
};

bootApp();
