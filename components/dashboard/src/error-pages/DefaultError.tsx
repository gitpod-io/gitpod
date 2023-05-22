/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import { Heading1, Subheading } from "../components/typography/headings";
import { ErrorPageLayout } from "./ErrorPageLayout";
import img404 from "../images/404.webp";
import img4042x from "../images/404@2x.webp";

const DefaultError: FC = () => {
    return (
        <ErrorPageLayout>
            <img
                className="mb-8"
                src={img404}
                srcSet={`${img404} 1x, ${img4042x} 2x`}
                alt="404 illustration"
                width="512"
                height="422"
            />
            <Heading1>Oops!</Heading1>
            <Subheading className="mt-4">Something didn't work quite right.</Subheading>

            <Subheading className="mt-4">Please contact Gitpod if you continue to have this issue.</Subheading>
        </ErrorPageLayout>
    );
};

export default DefaultError;
