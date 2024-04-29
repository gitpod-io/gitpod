/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useEffect, useMemo, useState } from "react";
import debounce from "lodash/debounce";

type DebounceOptions = {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
};

export const useDebounce = <T>(value: T, delay = 500, options?: DebounceOptions): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    const debouncedSetValue = useMemo(() => {
        return debounce(setDebouncedValue, delay, {
            leading: options?.leading || false,
            trailing: options?.trailing || true,
            // ensures debounced value is updated at least every 1s
            maxWait: options?.maxWait ?? 1000,
        });
    }, [delay, options?.leading, options?.maxWait, options?.trailing]);

    useEffect(() => {
        debouncedSetValue(value);
    }, [value, debouncedSetValue]);

    return debouncedValue;
};
