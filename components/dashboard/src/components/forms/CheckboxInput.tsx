/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC, useCallback } from "react";
import { useId } from "../../hooks/useId";

type Props = {
    id?: string;
    value: string;
    checked: boolean;
    label: string;
    onChange: (checked: boolean) => void;
};
export const CheckboxInput: FC<Props> = ({ id, value, label, checked, onChange }) => {
    const maybeId = useId();
    const elementId = id || maybeId;

    const handleChange = useCallback(
        (e) => {
            onChange(e.target.checked);
        },
        [onChange],
    );

    return (
        <label className="flex space-x-2 justify-start items-center" htmlFor={elementId}>
            <input
                type="checkbox"
                className="rounded"
                value={value}
                id={elementId}
                checked={checked}
                onChange={handleChange}
            />
            <span className="text-sm dark:text-gray-400 text-gray-600">{label}</span>
        </label>
    );
};
