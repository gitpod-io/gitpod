/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useMemo, useState } from "react";
import debounce from "lodash.debounce";

export const useDebounce = <T>(value: T, delay = 500): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    const debouncedSetValue = useMemo(() => {
        return debounce(setDebouncedValue, delay);
    }, [delay]);

    useEffect(() => {
        debouncedSetValue(value);
    }, [value, debouncedSetValue]);

    return debouncedValue;
};
