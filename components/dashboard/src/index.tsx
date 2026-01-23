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
 * Shows Ona branding and a "Continue with Ona" button.
 */
function renderMinimalLoginPage(): void {
    const root = document.getElementById("root");
    if (!root) return;

    root.innerHTML = `
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
            .minimal-container {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(390deg, #1F1329 0%, #333A75 20%, #556CA8 50%, #90A898 60%, #90A898 70%, #E2B15C 90%, #BEA462 100%);
                padding: 20px;
            }
            .minimal-card {
                background: white;
                border-radius: 16px;
                padding: 48px 40px;
                max-width: 420px;
                width: 100%;
                text-align: center;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            }
            .minimal-logo {
                height: 48px;
                margin-bottom: 32px;
            }
            .minimal-title {
                font-size: 24px;
                font-weight: 600;
                color: #1a1a1a;
                margin-bottom: 8px;
            }
            .minimal-subtitle {
                color: #666;
                margin-bottom: 32px;
                line-height: 1.5;
            }
            .minimal-btn {
                display: inline-block;
                background: #0048FF;
                color: white;
                padding: 14px 32px;
                border-radius: 10px;
                text-decoration: none;
                font-weight: 500;
                font-size: 16px;
                transition: background 0.2s;
            }
            .minimal-btn:hover {
                background: #0036cc;
            }
            .minimal-footer {
                margin-top: 32px;
                font-size: 13px;
                color: #888;
            }
            .minimal-footer a {
                color: #666;
                text-decoration: underline;
            }
            .minimal-footer a:hover {
                color: #333;
            }
        </style>
        <div class="minimal-container">
            <div class="minimal-card">
                <svg class="minimal-logo" viewBox="0 0 100 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 0C7.163 0 0 7.163 0 16s7.163 16 16 16 16-7.163 16-16S24.837 0 16 0zm0 28C9.373 28 4 22.627 4 16S9.373 4 16 4s12 5.373 12 12-5.373 12-12 12z" fill="#0048FF"/>
                    <path d="M44.5 8h3.8l5.7 16h-3.5l-1.1-3.3h-6l-1.1 3.3H39L44.5 8zm4 10l-2-6.2-2 6.2h4zM56.5 8h3.2v6.5l5.3-6.5h4l-5.8 6.8 6.2 9.2h-4l-4.5-6.8-1.2 1.4v5.4h-3.2V8zM71.5 8h3.2v6.5l5.3-6.5h4l-5.8 6.8 6.2 9.2h-4l-4.5-6.8-1.2 1.4v5.4h-3.2V8z" fill="#1a1a1a"/>
                </svg>
                <h1 class="minimal-title">Start building with Ona</h1>
                <p class="minimal-subtitle">
                    Gitpod Classic has been sunset.<br/>
                    Continue your journey with Ona.
                </p>
                <a href="https://app.ona.com/login" class="minimal-btn">Continue with Ona</a>
                <p class="minimal-footer">
                    <a href="https://ona.com/stories/gitpod-classic-payg-sunset" target="_blank" rel="noopener noreferrer">Learn more about the transition</a>
                </p>
            </div>
        </div>
    `;
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
