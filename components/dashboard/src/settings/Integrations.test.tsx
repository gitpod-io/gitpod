/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { render, fireEvent, screen } from "@testing-library/react";
import { GitIntegrationModal } from "./Integrations";

test.only("should update redirectURL preview", async () => {
    render(<GitIntegrationModal mode="new" userId="F00" />);

    fireEvent.change(screen.getByLabelText(/Host/i), {
        target: { value: "gitlab.gitpod.io:80" },
    });
    const host = screen.getByLabelText(/Host/i);
    // screen.debug(host);
    expect((host as HTMLInputElement).value).toEqual("gitlab.gitpod.io:80");

    const redirectURL = screen.getByLabelText(/Redirect/i);
    // screen.debug(redirectURL);
    expect((redirectURL as HTMLInputElement).value).toEqual("http://localhost/auth/gitlab.gitpod.io_80/callback");
});
