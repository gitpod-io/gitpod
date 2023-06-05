/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const ThemeContext = createContext<{
    isDark?: boolean;
    setIsDark: React.Dispatch<boolean>;
}>({
    setIsDark: () => null,
});

export const ThemeContextProvider: React.FC = ({ children }) => {
    const [isDark, setIsDark] = useState<boolean>(document.documentElement.classList.contains("dark"));

    const actuallySetIsDark = useCallback((dark: boolean) => {
        document.documentElement.classList.toggle("dark", dark);
        setIsDark(dark);
    }, []);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            if (document.documentElement.classList.contains("dark") !== isDark) {
                setIsDark(!isDark);
            }
        });
        observer.observe(document.documentElement, { attributes: true });
        return function cleanUp() {
            observer.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sets theme, tracks it in local storage and listens for changes in localstorage
    useEffect(() => {
        const updateTheme = () => {
            const isDark =
                localStorage.theme === "dark" ||
                (localStorage.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
            actuallySetIsDark(isDark);
        };
        updateTheme();
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        if (mediaQuery instanceof EventTarget) {
            mediaQuery.addEventListener("change", updateTheme);
        } else {
            // backward compatibility for Safari < 14
            (mediaQuery as MediaQueryList).addListener(updateTheme);
        }
        window.addEventListener("storage", updateTheme);
        return function cleanup() {
            if (mediaQuery instanceof EventTarget) {
                mediaQuery.removeEventListener("change", updateTheme);
            } else {
                // backward compatibility for Safari < 14
                (mediaQuery as MediaQueryList).removeListener(updateTheme);
            }
            window.removeEventListener("storage", updateTheme);
        };
    }, [actuallySetIsDark]);

    const ctx = useMemo(() => ({ isDark, setIsDark: actuallySetIsDark }), [actuallySetIsDark, isDark]);

    return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    return useContext(ThemeContext);
};

/**
 * Helper for making components themable and invertable, i.e. supports being used on an inverted backround.
 *
 * @param lightClass css class for light theme
 * @param darkClass corresponding css class for dark theme
 * @param inverted if the classes should be inverted, i.e. the component is on an inverted background
 * @returns Array containing the two class strings w/ the proper one prefixed with `dark:`
 */
export const invertable = (lightClass: string, darkClass: string, inverted = false) => {
    return [!inverted ? lightClass : darkClass, !inverted ? `dark:${darkClass}` : `dark:${lightClass}`];
};
