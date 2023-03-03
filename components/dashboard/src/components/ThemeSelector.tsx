/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FC, useCallback, useContext, useState } from "react";
import { ThemeContext } from "../theme-context";
import SelectableCardSolid from "./SelectableCardSolid";
import { Heading2, Subheading } from "./typography/headings";

type Theme = "light" | "dark" | "system";

type Props = {
    className?: string;
};
// Theme Selection is purely clientside, so this component handles all state and writes to localStorage
export const ThemeSelector: FC<Props> = ({ className }) => {
    const { setIsDark } = useContext(ThemeContext);
    const [theme, setTheme] = useState<Theme>(localStorage.theme || "system");

    const actuallySetTheme = useCallback(
        (theme: Theme) => {
            if (theme === "dark" || theme === "light") {
                localStorage.theme = theme;
            } else {
                localStorage.removeItem("theme");
            }
            const isDark =
                localStorage.theme === "dark" ||
                (localStorage.theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
            setIsDark(isDark);
            setTheme(theme);
        },
        [setIsDark],
    );

    return (
        <div className={classNames(className)}>
            <Heading2>Theme</Heading2>
            <Subheading>Early bird or night owl? Choose your side.</Subheading>
            <div className="mt-4 flex items-center flex-wrap">
                <SelectableCardSolid
                    className="w-36 h-32 m-1"
                    title="Light"
                    selected={theme === "light"}
                    onClick={() => actuallySetTheme("light")}
                >
                    <div className="flex-grow flex items-end p-1">
                        <svg width="112" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M0 8a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM0 32a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM0 56a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM40 6a6 6 0 0 1 6-6h60a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6V6Z"
                                fill="#D6D3D1"
                            />
                        </svg>
                    </div>
                </SelectableCardSolid>
                <SelectableCardSolid
                    className="w-36 h-32 m-1"
                    title="Dark"
                    selected={theme === "dark"}
                    onClick={() => actuallySetTheme("dark")}
                >
                    <div className="flex-grow flex items-end p-1">
                        <svg width="112" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M0 8a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM0 32a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM0 56a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM40 6a6 6 0 0 1 6-6h60a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6V6Z"
                                fill="#78716C"
                            />
                        </svg>
                    </div>
                </SelectableCardSolid>
                <SelectableCardSolid
                    className="w-36 h-32 m-1"
                    title="System"
                    selected={theme === "system"}
                    onClick={() => actuallySetTheme("system")}
                >
                    <div className="flex-grow flex items-end p-1">
                        <svg width="112" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M0 8a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8ZM40 6a6 6 0 0 1 6-6h60a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6V6Z"
                                fill="#D9D9D9"
                            />
                            <path
                                d="M84 0h22a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H68L84 0ZM0 32a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8Z"
                                fill="#78716C"
                            />
                            <path d="M0 56a8 8 0 0 1 8-8h16a8 8 0 1 1 0 16H8a8 8 0 0 1-8-8Z" fill="#D9D9D9" />
                        </svg>
                    </div>
                </SelectableCardSolid>
            </div>
        </div>
    );
};
