/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import Cookies, { CookieAttributes } from "js-cookie";

export const COOKIE_NAME = `${window.location.hostname}-consent`;

export let cookieConsentDefaultValue = {
    necessary: true,
    analytical: false,
    targeting: false,
};

export function cookieSettingOptions(domain: string): CookieAttributes {
    return {
        domain: `.${domain}`,
        expires: 365,
        path: "/",
        secure: false,
        sameSite: "lax",
    };
}

export function setNonNecessaryValues(analyticalValue: boolean, targetingValue: boolean) {
    return {
        ...cookieConsentDefaultValue,
        analytical: analyticalValue,
        targeting: targetingValue,
    };
}

export function serialize(value: any) {
    const stringified = JSON.stringify(value);
    const quotesRemoved = stringified.replace("%22", '"');
    return quotesRemoved;
}

export function setCookie(analyticalValue: boolean, targetingValue: boolean) {
    return Cookies.set(
        COOKIE_NAME,
        serialize(setNonNecessaryValues(analyticalValue, targetingValue)),
        cookieSettingOptions(window.location.hostname),
    );
}

export function getConsentCookies() {
    return Cookies.get(COOKIE_NAME);
}
