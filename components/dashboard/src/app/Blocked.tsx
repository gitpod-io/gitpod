/**
 * Copyright (c) 2022 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FunctionComponent } from "react";
import { Heading1, Subheading } from "../components/typography/headings";
import gitpodIcon from "../icons/gitpod.svg";
import { Button } from "@podkit/buttons/Button";

export const Blocked: FunctionComponent = () => {
    return (
        <div className="mt-48 text-center">
            <img src={gitpodIcon} className="h-16 mx-auto" alt="Gitpod's logo" />
            <Heading1 color="light" className="mt-12">
                Your account has been blocked.
            </Heading1>
            <Subheading className="mt-4 mb-8 w-96 mx-auto">
                Please contact support if you think this is an error. See also{" "}
                <a className="gp-link" href="https://www.gitpod.io/terms/">
                    terms of service
                </a>
                .
            </Subheading>
            <a className="mx-auto" href="mailto:support@gitpod.io?Subject=Blocked">
                <Button variant="secondary">Contact Support</Button>
            </a>
        </div>
    );
};
