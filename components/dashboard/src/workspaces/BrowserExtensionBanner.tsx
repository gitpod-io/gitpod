/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useState } from "react";
import UAParser from "ua-parser-js";
import flashIcon from "../icons/Flash.svg";

interface BrowserOption {
    url: string;
}

const installationOptions: Record<string, BrowserOption> = {
    firefox: {
        url: "https://addons.mozilla.org/en-US/firefox/addon/gitpod/",
    },
    chrome: {
        url: "https://chrome.google.com/webstore/detail/gitpod-always-ready-to-co/dodmmooeoklaejobgleioelladacbeki",
    },
    edge: {
        url: "https://chrome.google.com/webstore/detail/gitpod-always-ready-to-co/dodmmooeoklaejobgleioelladacbeki",
    },
};

interface BrowserExtensionBannerProps {
    parser?: UAParser;
}

export function BrowserExtensionBanner({ parser = new UAParser() }: BrowserExtensionBannerProps) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const persistedDisabled =
            sessionStorage.getItem("browser-extension-installed") ||
            localStorage.getItem("browser-extension-banner-dismissed");

        if (persistedDisabled) {
            setIsVisible(false);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem("browser-extension-banner-dismissed", "true");
        setIsVisible(false);
    };

    if (!isVisible) {
        return null;
    }

    const browserName = parser.getBrowser().name?.toLowerCase();
    if (!browserName) {
        return null;
    }

    const browserOption = installationOptions[browserName];
    if (!browserOption) {
        return null;
    }

    return (
        <section className="hidden p-4 sm:block sm:absolute sm:bottom-2 sm:left-2">
            <div className="grid h-28 w-72 grid-cols-12 items-end gap-x-2 rounded-xl border-2 border-dashed border-[#dadada] bg-[#fafaf9] dark:bg-gray-800 dark:border-gray-600 p-4">
                <div className="col-span-2">
                    <img src={flashIcon} alt="" className="h-8 w-8" />
                </div>

                <div className="col-span-9">
                    <p className="text-sm font-medium leading-5 text-[#666564]">
                        Faster workflows directly from your repository.
                    </p>
                </div>
                <div className="col-span-1 flex justify-end items-start h-full pt -1">
                    <button className="reset right-8 top-6 text-gray-500 dark:text-gray-200" onClick={handleClose}>
                        &#10005;
                    </button>
                </div>
                <div className="col-span-2"></div>

                <div className="col-span-10">
                    <a
                        href={browserOption.url}
                        className="text-sm font-semibold text-blue-500"
                        target="_blank"
                        rel="noreferrer"
                    >
                        Try the browser extension →
                    </a>
                </div>
            </div>
        </section>
    );
}
