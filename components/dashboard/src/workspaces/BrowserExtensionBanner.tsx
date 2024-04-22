/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useMemo, useState } from "react";
import UAParser from "ua-parser-js";

type BrowserOption = {
    aliases?: string[];
    url: string;
};

const installationOptions: Record<string, BrowserOption> = {
    firefox: {
        url: "https://addons.mozilla.org/en-US/firefox/addon/gitpod/",
    },
    chrome: {
        aliases: ["edge", "brave", "chromium", "vivaldi", "opera"],
        url: "https://chrome.google.com/webstore/detail/gitpod-always-ready-to-co/dodmmooeoklaejobgleioelladacbeki",
    },
};

export function BrowserExtensionBanner() {
    const parser = useMemo(() => new UAParser(), []);
    const browserName = useMemo(() => parser.getBrowser().name?.toLowerCase(), [parser]);

    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const installedOrDismissed =
            sessionStorage.getItem("browser-extension-installed") ||
            localStorage.getItem("browser-extension-banner-dismissed");

        setIsVisible(!installedOrDismissed);
    }, []);

    // Todo: Implement the x button
    // const handleClose = () => {
    //     localStorage.setItem("browser-extension-banner-dismissed", "true");
    //     setIsVisible(false);
    // };

    if (!isVisible) {
        return null;
    }

    if (!browserName) {
        return null;
    }

    let browserOption: BrowserOption | undefined = installationOptions[browserName];
    if (!browserOption) {
        browserOption = Object.values(installationOptions).find(
            (opt) => opt.aliases && opt.aliases.includes(browserName),
        );
        if (!browserOption) {
            return null;
        }
    }

    return (
        <section className="sm:flex justify-between border-2 rounded-xl m-4 hidden max-w-xl mt-4">
            <div className="flex flex-col gap-1 py-4 px-2 justify-center">
                <span className="text-lg font-semibold">Open from Github</span>
                <span>
                    <a href={browserOption.url} className="gp-link">
                        Install the Gitpod extension
                    </a>
                    to launch workspaces from Github.
                </span>
            </div>
            <img alt="A button that says Gitpod" src="https://picsum.photos/151/88" />
        </section>
    );
}
