/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { IDEOptions } from "@gitpod/gitpod-protocol/lib/ide-protocol";
import { useEffect, useState } from "react";
import { getGitpodService } from "../service/service";
import MutableSelectIDEComponent, { MutableSelectIDEComponentProps } from "./MutableSelectIDEComponent";

type SelectIDEComponentProps = Omit<MutableSelectIDEComponentProps, "ideOptions">;

export default function SelectIDEComponent(props: SelectIDEComponentProps) {
    const [ideOptions, setIdeOptions] = useState<IDEOptions>();
    useEffect(() => {
        getGitpodService().server.getIDEOptions().then(setIdeOptions);
    }, []);
    return <MutableSelectIDEComponent ideOptions={ideOptions} {...props} />;
}
