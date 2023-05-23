/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { FC } from "react";

// Add necessary contexts for tests to run
export const TestContext: FC = ({ children }) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

type RenderParameters = Parameters<typeof render>;
type RenderReturn = ReturnType<typeof render>;

// render() with <TestContext> wrapper
export const renderWithContext = (ui: RenderParameters["0"], options?: RenderParameters["1"]): RenderReturn => {
    return render(<TestContext>{ui}</TestContext>, options);
};
