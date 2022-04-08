/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { useState } from "react";
import CheckBox from "./components/CheckBox";
import Modal from "./components/Modal";
import { cookieConsentDefaultValue, getConsentCookies, setCookie } from "./consent-cookie";

function CookieSettingsModal(props: {
    showCookieSettings: boolean;
    cookiePreferences: { necessary: boolean; analytical: boolean; targeting: boolean };
    onClose: () => void;
    onSave: () => void;
}) {
    const [cookiePreferences, setCookiePreferences] = useState(cookieConsentDefaultValue);

    const handleAnalyticalCheckboxChange = () => {
        setCookiePreferences({
            ...cookiePreferences,
            analytical: !cookiePreferences.analytical,
        });
    };

    const handleTargetingCheckboxChange = () => {
        setCookiePreferences({
            ...cookiePreferences,
            targeting: !cookiePreferences.targeting,
        });
    };

    const onSave = () => {
        setCookie(cookiePreferences.analytical, cookiePreferences.targeting);
        setCookiePreferences({
            ...cookieConsentDefaultValue,
            analytical: cookiePreferences.analytical,
            targeting: cookiePreferences.targeting,
        });

        props.onSave();
    };

    const onClose = () => {
        const value = getConsentCookies();
        if (value) {
            setCookiePreferences(JSON.parse(value));
        }

        props.onClose();
    };

    return (
        <Modal visible={props.showCookieSettings} onClose={onClose}>
            <h3 className="mb-4">Cookie settings</h3>
            <div className="flex flex-col -mx-6 px-6 py-4 border-t border-b border-gray-200 dark:border-gray-800">
                <div className="flex gap-2">
                    <div className="-mt-4">
                        <CheckBox title="" desc={undefined} checked={true} disabled={true} name="necessary" />
                    </div>
                    <h4>Strictly necessary cookies</h4>
                </div>
                <p className="mb-4">
                    These are cookies that are required for the operation of our website and under our terms with you.
                    They include, for example, cookies that enable you to log into secure areas of our website or make
                    use of our teams and subscription services.
                </p>
                <div className="flex gap-2">
                    <div className="-mt-4">
                        <CheckBox
                            title=""
                            desc={undefined}
                            checked={cookiePreferences.analytical}
                            name="analytical"
                            onChange={handleAnalyticalCheckboxChange}
                        />
                    </div>
                    <h4>Analytical & performance cookies</h4>
                </div>
                <p className="mb-4">
                    These allow us to recognise and count the number of visitors and to see how visitors move around our
                    website when they are using it. This helps us improve the way our website works, for example, by
                    ensuring that users are finding what they are looking for easily.
                </p>
                <div className="flex gap-2">
                    <div className="-mt-4">
                        <CheckBox
                            title=""
                            desc={undefined}
                            checked={cookiePreferences.targeting}
                            name="targeting"
                            onChange={handleTargetingCheckboxChange}
                        />
                    </div>
                    <h4>Targeting & advertising cookies</h4>
                </div>
                <p className="mb-4">
                    These cookies record your visit to our website, the pages you have visited and the links you have
                    followed. We will use this information subject to your choices and preferences to make our website
                    and the advertising displayed on it more relevant to your interests. We may also share this
                    information with third parties for this purpose.
                </p>
            </div>
            <div className="flex justify-end mt-6">
                <button className="secondary" onClick={onClose}>
                    Cancel
                </button>
                <button className="ml-2" onClick={onSave}>
                    Save
                </button>
            </div>
        </Modal>
    );
}

export default CookieSettingsModal;
