/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import UAParser from "ua-parser-js";
interface BrowserOption {
    url: string;
    icon: string;
}

const installationOptions: Record<string, BrowserOption> = {
    firefox: {
        url: "https://addons.mozilla.org/en-US/firefox/addon/gitpod/",
        icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Firefox_logo%2C_2019.svg/1920px-Firefox_logo%2C_2019.svg.png",
    },
    chrome: {
        url: "https://chrome.google.com/webstore/detail/gitpod-always-ready-to-co/dodmmooeoklaejobgleioelladacbeki",
        icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Google_Chrome_icon_%28February_2022%29.svg/1920px-Google_Chrome_icon_%28February_2022%29.svg.png",
    },
    edge: {
        url: "https://chrome.google.com/webstore/detail/gitpod-always-ready-to-co/dodmmooeoklaejobgleioelladacbeki",
        icon: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Edge_Logo_2019.svg/1920px-Edge_Logo_2019.svg.png",
    },
};

interface BrowserExtensionBannerProps {
    parser?: UAParser;
}

export function BrowserExtensionBanner({ parser = new UAParser() }: BrowserExtensionBannerProps) {
    const browserName = parser.getBrowser().name?.toLowerCase();
    if (!browserName) {
        return null;
    }

    const browserOption = installationOptions[browserName];
    if (!browserOption) {
        return null;
    }

    return (
        <div className="relative flex justify-center p-4 sm:absolute sm:bottom-2 sm:left-2">
            <div className="grid h-28 w-72 grid-cols-6 items-end gap-x-2 rounded-xl border-2 border-dashed border-[#dadada] bg-[#fafaf9] p-4">
                <div className="col-span-1">
                    <img src={browserOption.icon} alt="" className="h-8 w-8" />
                </div>

                <div className="col-span-5">
                    <p className="text-sm font-medium leading-5 text-[#666564]">
                        Faster workflows directly from your repository.
                    </p>
                </div>
                <div className="col-span-1"></div>

                <div className="col-span-5">
                    <a href={browserOption.url} className="text-sm font-semibold text-blue-500">
                        Try the browser extension →
                    </a>
                </div>
            </div>
        </div>
    );
}
