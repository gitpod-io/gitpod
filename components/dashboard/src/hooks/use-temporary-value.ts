/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type UseTemporaryStateReturnType<ValueType> = [value: ValueType, set: (value: ValueType) => void];

/**
 * @description Hook to have state that reverts to a default value after a timeout when you update it. Useful for temporarily showing messages or disabling buttons.
 *
 * @param defaultValue Default value
 * @param timeout Milliseconds to revert to default value after setting a temporary value
 * @returns [value, setTemporaryValue]
 */
export const useTemporaryState = <ValueType>(
    defaultValue: ValueType,
    timeout: number,
): UseTemporaryStateReturnType<ValueType> => {
    const [value, setValue] = useState<ValueType>(defaultValue);
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

    const setTemporaryValue = useCallback(
        (tempValue: ValueType, revertValue?: ValueType) => {
            timeoutRef.current && clearTimeout(timeoutRef.current);

            setValue(tempValue);

            timeoutRef.current = setTimeout(() => {
                setValue(revertValue !== undefined ? revertValue : defaultValue);
            }, timeout);
        },
        [defaultValue, timeout],
    );

    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }, []);

    return [value, setTemporaryValue];
};
