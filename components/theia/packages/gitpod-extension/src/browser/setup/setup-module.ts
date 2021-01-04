/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

import { interfaces } from "inversify";
import { SetupManager, SetupManagerImpl } from "./setup-manager";
import { SetupViewContribution } from "./setup-view-contribution";
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from "@theia/core/lib/browser";
import { SetupView } from "./setup-view";
import { CommandContribution } from "@theia/core";
import { bindSetupPreferences } from "./setup-preferences";

export const setupModule: interfaces.ContainerModuleCallBack = ((bind, unbind, isBound, rebind) => {
    bind(SetupManagerImpl).toSelf().inSingletonScope();
    bind(SetupManager).to(SetupManagerImpl);
    bindViewContribution(bind, SetupViewContribution);
    bind(FrontendApplicationContribution).toService(SetupViewContribution);
    bind(CommandContribution).to(SetupManagerImpl);
    bind(SetupView).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: SetupView.ID,
        createWidget: () => ctx.container.get<SetupView>(SetupView)
    }));
    bindSetupPreferences(bind);
});