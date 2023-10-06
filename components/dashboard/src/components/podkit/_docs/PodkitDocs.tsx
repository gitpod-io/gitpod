/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { FC } from "react";
import TooltipGP from "../../Tooltip";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip/TooltipShadCN";

export const PodkitDocs: FC = () => {
    return (
        <div className="flex flex-col px-8 my-4">
            <h1>Podkit Docs</h1>

            <p>A marvelous thing</p>

            <h2>Components</h2>

            <h3>Tooltip</h3>

            <div>
                <p>
                    <span>Here we have </span>
                    <TooltipGP content={"A helpful tip"}>some content</TooltipGP>
                    <span> along with more text.</span>
                </p>

                <p>
                    <span>Here we have </span>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span>some content</span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>a helpful tip</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <span> along with more text.</span>
                </p>
            </div>
        </div>
    );
};
