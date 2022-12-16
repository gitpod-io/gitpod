/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent } from "react";
import gitpodIcon from "../icons/gitpod.svg";

export const Blocked: FunctionComponent = () => {
    return (
        <div className="mt-48 text-center">
            <img src={gitpodIcon} className="h-16 mx-auto" alt="Gitpod's logo" />
            <h1 className="mt-12 text-gray-500 text-3xl">Your account has been blocked.</h1>
            <p className="mt-4 mb-8 text-lg w-96 mx-auto">
                Please contact support if you think this is an error. See also{" "}
                <a className="hover:text-blue-600 dark:hover:text-blue-400" href="https://www.gitpod.io/terms/">
                    terms of service
                </a>
                .
            </p>
            <a className="mx-auto" href="mailto:support@gitpod.io?Subject=Blocked">
                <button className="secondary">Contact Support</button>
            </a>
        </div>
    );
};
