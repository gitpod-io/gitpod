/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useMemo, useState } from "react";
import debounce from "lodash.debounce";

export const useStateWithDebounce = <T>(initialValue: T, delay = 300): [T, (value: T) => void, T] => {
    const [value, setValue] = useState<T>(initialValue);
    const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);

    const debouncedSetValue = useMemo(() => {
        return debounce(setDebouncedValue, delay);
    }, [delay]);

    useEffect(() => {
        debouncedSetValue(value);
    }, [value, debouncedSetValue]);

    return [value, setValue, debouncedValue];
};
