/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import gitpodIcon from "../images/gitpod.svg";
import gitpodDarkIcon from "../images/gitpod-dark.svg";
import { useTheme } from "../theme-context";
import { FC } from "react";
import "../dedicated-setup/styles.css";

export const ErrorPageLayout: FC = ({ children }) => {
    const { isDark } = useTheme();
    return (
        <div className="container">
            <div className="app-container">
                <div className="flex items-center justify-center items-center py-3">
                    <img src={isDark ? gitpodDarkIcon : gitpodIcon} className="h-8" alt="Gitpod's logo" />
                </div>
                <div className={`mt-24 max-w-lg mx-auto text-center`}>
                    <div>{children}</div>
                </div>
            </div>
        </div>
    );
};
