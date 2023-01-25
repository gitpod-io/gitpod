/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import classNames from "classnames";
import { FunctionComponent, memo, ReactNode } from "react";

type Props = {
    label: ReactNode;
    id?: string;
    hint?: ReactNode;
    error?: ReactNode;
};

export const InputField: FunctionComponent<Props> = memo(({ label, id, hint, error, children }) => {
    return (
        <div className="mt-4 flex flex-col space-y-2">
            <label
                className={classNames(
                    "text-sm font-semibold dark:text-gray-400",
                    error ? "text-red-600" : "text-gray-600",
                )}
                htmlFor={id}
            >
                {label}
            </label>
            {children}
            {error && <span className="text-red-500 text-sm">{error}</span>}
            {hint && <span className="text-gray-500 text-sm">{hint}</span>}
        </div>
    );
});
