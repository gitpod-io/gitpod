/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { LinkButton } from "@podkit/buttons/LinkButton";
import { cn } from "@podkit/lib/cn";
import { ChevronLeft } from "lucide-react";
import type { FC } from "react";
import { MiddleDot } from "../../typography/MiddleDot";
import { Heading3 } from "@podkit/typography/Headings";

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
    className?: string;
}

export const BreadcrumbNav: FC<BreadcrumbPageNavProps> = ({ pageTitle, pageDescription, backLink, className }) => {
    return (
        <section className={cn("flex flex-row items-center justify-start gap-2 w-full py-4 app-container", className)}>
            {backLink && (
                <LinkButton
                    variant={"ghost"}
                    className="py-1 px-0 hover:bg-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    href={backLink}
                >
                    <ChevronLeft size={24} />
                </LinkButton>
            )}
            <Heading3 asChild>
                <h1>{pageTitle}</h1>
            </Heading3>
            <MiddleDot />
            <p className="text-gray-900 dark:text-gray-300 text-lg">{pageDescription}</p>
        </section>
    );
};
