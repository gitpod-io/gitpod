/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LinkButton } from "@podkit/buttons/LinkButton";
import { ChevronLeft } from "lucide-react";
import type { FC } from "react";

interface BreadcrumbPageNavProps {
    /**
     * The title of the current page.
     */
    pageTitle: string;
    /**
     * The description of the current page.
     */
    pageDescription?: string;
    /**
     * The link to the previous page.
     */
    backLink?: string;
}

export const BreadcrumbNav: FC<BreadcrumbPageNavProps> = ({
    children,
    pageTitle,
    pageDescription,
    backLink,
    ...props
}) => {
    return (
        <section className="flex flex-row items-center justify-start gap-2 w-full">
            {backLink && (
                <LinkButton variant={"ghost"} className="py-2 px-2" href={backLink}>
                    <ChevronLeft size={24} />
                </LinkButton>
            )}
            <h1 className="text-lg font-bold">{pageTitle}</h1>
            <span>·</span>
            <p className="gray-900 dark:gray-300 text-md">{pageDescription}</p>
        </section>
    );
};
