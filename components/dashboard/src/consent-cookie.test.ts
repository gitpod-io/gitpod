/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { cookieSettingOptions, getConsentCookies, setCookie } from "./consent-cookie";

jest.useFakeTimers("modern").setSystemTime(new Date("2022-01-01"));

test("cookieSettingOptions", () => {
    expect(cookieSettingOptions("testing.dev.com")).toStrictEqual({
        domain: ".testing.dev.com",
        expires: 365,
        path: "/",
        sameSite: "lax",
        secure: false,
    });
});

test("setCookie", () => {
    expect(setCookie(true, false)).toBe(
        "localhost-consent={%22necessary%22:true%2C%22analytical%22:true%2C%22targeting%22:false}; path=/; domain=.localhost; expires=Sun, 01 Jan 2023 00:00:00 GMT; sameSite=lax",
    );
});

test("getConsentCookies as set in the setCookie test", () => {
    expect(getConsentCookies()).toBe('{"necessary":true,"analytical":true,"targeting":false}');
});
