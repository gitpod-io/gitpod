/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import gitpodIcon from "../icons/gitpod.svg";
import "./styles.css";

export const SetupLayout: FC = ({ children }) => {
    return (
        <div className="container">
            <div className="app-container">
                <div className="flex items-center justify-start items-center py-3 space-x-1">
                    <img src={gitpodIcon} className="h-6" alt="Gitpod's logo" />
                    <span className="text-lg">Gitpod</span>
                </div>
                <div className="mt-24 max-w-md">{children}</div>
            </div>
        </div>
    );
};
