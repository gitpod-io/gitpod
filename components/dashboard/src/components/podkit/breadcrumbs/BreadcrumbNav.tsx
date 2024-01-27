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
                    className="py-1 pl-0 pr-2 text-content-primary hover:bg-pk-surface-tertiary flex flex-row gap-1 items-center"
                    href={backLink}
                >
                    <ChevronLeft size={24} />
                    <Heading3 asChild>
                        <h1>{pageTitle}</h1>
                    </Heading3>
                </LinkButton>
            )}
            <MiddleDot />
            <p className="text-pk-content-primary text-lg">{pageDescription}</p>
        </section>
    );
};
