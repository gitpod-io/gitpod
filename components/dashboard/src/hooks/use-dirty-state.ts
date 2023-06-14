/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useState } from "react";

// a hook that tracks whether a value has been changed from its initial value
export const useDirtyState = <T>(initialValue: T): [T, (val: T, trackDirty?: boolean) => void, boolean] => {
    const [value, setValue] = useState<T>(initialValue);
    const [dirty, setDirty] = useState<boolean>(false);

    // sets value, and by default sets dirty flag to true
    // trackDirty can be optionally overridden to prevent setting the dirty flag
    // this is useful for cases where a value needs to be updated, but not necessarily treat it as dirty
    const setDirtyValue = useCallback((value: T, trackDirty = true) => {
        setValue(value);
        if (trackDirty) {
            setDirty(true);
        }
    }, []);

    return [value, setDirtyValue, dirty];
};
