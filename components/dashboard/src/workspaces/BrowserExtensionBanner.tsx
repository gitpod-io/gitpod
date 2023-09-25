/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import UAParser from "ua-parser-js";

export function BrowserExtensionBanner() {
    const parser = new UAParser();
    const parserResults = parser.getResult();
    const browserName = parserResults.browser.name;

    const installationOptions = {
        firefox: {
            url: "https://google.com",
        },
        chrome: {
            url: "https://google.com",
        },
        edge: {
            url: "https://google.com",
        },
    };

    const browserOption = installationOptions[browserName.toLowerCase()];
    if (!Object.keys(installationOptions).includes(browserName.toLowerCase())) {
        return null;
    }

    return (
        <div className="relative flex justify-center p-4 sm:absolute sm:bottom-2 sm:left-2">
            <div className="grid h-28 w-72 grid-cols-6 items-end gap-x-2 rounded-xl border-2 border-dashed border-[#dadada] bg-[#fafaf9] p-4">
                <div className="col-span-1">
                    <img
                        src="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Google_Chrome_icon_%28February_2022%29.svg/1920px-Google_Chrome_icon_%28February_2022%29.svg.png"
                        alt=""
                        className="h-8 w-8"
                    />
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
