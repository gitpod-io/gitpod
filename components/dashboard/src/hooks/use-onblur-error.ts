/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { useCallback, useState } from "react";

// Provided an error message and boolean indicating if related property is valid
// returns an error message if field has been blurred and it's invalid.
// An `onBlur` handler is meant to be applied to the relevant input field
export const useOnBlurError = (message: string, isValid: boolean) => {
    const [hasBlurred, setHasBlurred] = useState(false);

    const onBlur = useCallback(() => {
        setHasBlurred(true);
    }, []);

    return { message: !isValid && hasBlurred ? message : "", isValid, onBlur };
};
