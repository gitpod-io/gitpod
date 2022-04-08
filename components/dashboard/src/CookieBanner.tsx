/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { setCookie } from "./consent-cookie";

function CookieBanner(props: {
    onOpenCookieSettings: () => void;
    onAcceptAllCookies: () => void;
    onRejectAllCookies: () => void;
}) {
    const onAccept = () => {
        setCookie(true, true);
        props.onAcceptAllCookies();
    };

    const onReject = () => {
        setCookie(false, false);
        props.onRejectAllCookies();
    };

    return (
        <div className="flex justify-between items-center mx-auto h-12 px-4 py-2 text-center text-xs text-gray-600 bg-gray-200 w-full bottom-0 left-0 fixed">
            <p className="text-gray-600">
                The website uses cookies to enhance the user experience. Read our{" "}
                <a
                    className="gp-link hover:text-gray-600"
                    target="gitpod-privacy"
                    href="https://www.gitpod.io/privacy/"
                >
                    privacy policy{" "}
                </a>
                for more info.
            </p>
            <div className="flex gap-1">
                <button
                    className="py-3 bg-sand-dark underline text-xs text-gray-400 hover:text-gray-600"
                    onClick={() => props.onOpenCookieSettings()}
                >
                    Modify settings
                </button>
                <button className="bg-gray-100 rounded-lg hover:bg-white text-xs text-gray-600" onClick={onAccept}>
                    Accept Cookies
                </button>
                <button className="bg-gray-100 rounded-lg hover:bg-white text-xs text-gray-600" onClick={onReject}>
                    Reject All
                </button>
            </div>
        </div>
    );
}

export default CookieBanner;
