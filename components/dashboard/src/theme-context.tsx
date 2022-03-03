/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import React, { createContext, useEffect, useState } from 'react';

export const ThemeContext = createContext<{
    isDark?: boolean;
    setIsDark: React.Dispatch<boolean>;
}>({
    setIsDark: () => null,
});

export const ThemeContextProvider: React.FC = ({ children }) => {
    const [isDark, setIsDark] = useState<boolean>(document.documentElement.classList.contains('dark'));
    const actuallySetIsDark = (dark: boolean) => {
        document.documentElement.classList.toggle('dark', dark);
        setIsDark(dark);
    };

    useEffect(() => {
        const observer = new MutationObserver(() => {
            if (document.documentElement.classList.contains('dark') !== isDark) {
                setIsDark(!isDark);
            }
        });
        observer.observe(document.documentElement, { attributes: true });
        return function cleanUp() {
            observer.disconnect();
        };
    }, []);

    return <ThemeContext.Provider value={{ isDark, setIsDark: actuallySetIsDark }}>{children}</ThemeContext.Provider>;
};
