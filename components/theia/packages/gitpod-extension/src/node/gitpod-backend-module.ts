/**
 * Copyright (c) 2020 TypeFox GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License-AGPL.txt in the project root for license information.
 */

/**
 * Generated using theia-extension-generator
 */

import { ContainerModule } from "inversify";
import { GitPodExpressService } from './gitpod-express-service';
import { BackendApplicationContribution } from "@theia/core/lib/node/backend-application";
import { GitpodFileParser } from '@gitpod/gitpod-protocol/lib/gitpod-file-parser';

import { GitpodInfoProviderNodeImpl } from "./gitpod-info-backend";
import { ConnectionHandler, JsonRpcConnectionHandler } from "@theia/core";
import { ServedPortsServiceClient, ServedPortsService, ServedPortsServiceServer } from "../common/served-ports-service";
import { GitpodEnvVariablesServer } from "./gitpod-env-variables-server";
import { ShellProcess } from "@theia/terminal/lib/node/shell-process";
import { GitpodShellProcess } from "./gitpod-shell-process";
import { CliServiceServer, CliServiceServerImpl } from "./cli-service-server";
import { ILoggerServer } from "@theia/core/lib/common/logger-protocol";
import { JsonConsoleLoggerServer } from "./json-console-logger-server";
import { PluginDeployerResolver } from "@theia/plugin-ext/lib/common/plugin-protocol";
import { PluginPathsService } from "@theia/plugin-ext/lib/main/common/plugin-paths-protocol";
import { GitpodPluginPathService } from "./gitpod-plugin-path-service";
import { TheiaCLIService, SERVICE_PATH } from "../common/cli-service";
import { GitpodPluginResolver } from "./extensions/gitpod-plugin-resolver";
import { GitpodPluginDeployer } from "./extensions/gitpod-plugin-deployer";
import { HostedPluginDeployerHandler } from "@theia/plugin-ext/lib/hosted/node/hosted-plugin-deployer-handler";
import { GitpodPluginDeployerHandler } from "./extensions/gitpod-plugin-deployer-handler";
import { gitpodPluginPath, GitpodPluginClient } from "../common/gitpod-plugin-service";
import { GitpodPluginLocator } from "./extensions/gitpod-plugin-locator";
import { GitpodPluginLocatorClient } from "./extensions/gitpod-plugin-locator-client";
import { HostedPluginReader } from "@theia/plugin-ext/lib/hosted/node/plugin-reader";
import { GitpodPluginReader } from "./extensions/gitpod-plugin-reader";
import { gitpodInfoPath } from "../common/gitpod-info";
import { OpenVSXExtensionProviderImpl } from "./extensions/openvsx-extension-provider-impl";
import { openVSXExtensionProviderPath } from "../common/openvsx-extension-provider";
import { EnvVariablesServer } from "@theia/core/lib/common/env-variables";
import { SupervisorServedPortsServiceImpl } from "./supervisor-serverd-ports-service";
import { SupervisorClientProvider } from "./supervisor-client-provider";
import { GitpodTaskServer, GitpodTaskClient, gitpodTaskServicePath } from "../common/gitpod-task-protocol";
import { GitpodTaskServerImpl } from "./gitpod-task-server-impl";

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    rebind(ShellProcess).to(GitpodShellProcess).inTransientScope();

    rebind(ILoggerServer).to(JsonConsoleLoggerServer).inSingletonScope();

    bind(GitpodFileParser).toSelf().inSingletonScope();

    bind(GitPodExpressService).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(GitPodExpressService);

    bind(SupervisorClientProvider).toSelf().inSingletonScope();
    bind(ServedPortsServiceServer).to(SupervisorServedPortsServiceImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context =>
        new JsonRpcConnectionHandler<ServedPortsServiceClient>(ServedPortsService.SERVICE_PATH, client => {
            const server = context.container.get<ServedPortsServiceServer>(ServedPortsServiceServer);
            server.setClient(client);
            client.onDidCloseConnection(() => server.disposeClient(client));
            return server;
        })
    ).inSingletonScope();
    bind(GitpodTaskServer).to(GitpodTaskServerImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context =>
        new JsonRpcConnectionHandler<GitpodTaskClient>(gitpodTaskServicePath, client => {
            const server = context.container.get<GitpodTaskServerImpl>(GitpodTaskServer);
            server.setClient(client);
            client.onDidCloseConnection(() => server.disposeClient(client));
            return server;
        })
    ).inSingletonScope();

    bind(CliServiceServer).to(CliServiceServerImpl).inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(context =>
        new JsonRpcConnectionHandler<TheiaCLIService>(SERVICE_PATH, client => {
            const server = context.container.get<CliServiceServer>(CliServiceServer);
            server.setClient(client);
            client.onDidCloseConnection(() => server.disposeClient(client));
            return server;
        })
    ).inSingletonScope();

    if (!process.env['THEIA_LOCAL']) {
        rebind(EnvVariablesServer).to(GitpodEnvVariablesServer).inSingletonScope();
    }

    rebind(HostedPluginReader).to(GitpodPluginReader).inSingletonScope();

    bind(GitpodPluginDeployerHandler).toSelf().inSingletonScope();
    rebind(HostedPluginDeployerHandler).toService(GitpodPluginDeployerHandler);
    bind(GitpodPluginDeployer).toSelf().inSingletonScope();
    bind(BackendApplicationContribution).toService(GitpodPluginDeployer);
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler<GitpodPluginClient>(gitpodPluginPath, client => {
            const service = ctx.container.get(GitpodPluginDeployer)
            const toRemoveClient = service.addClient(client);
            client.onDidCloseConnection(() => toRemoveClient.dispose());
            return service;
        })
    ).inSingletonScope();

    bind(GitpodPluginLocator).to(GitpodPluginLocatorClient).inSingletonScope();
    bind(GitpodPluginResolver).toSelf().inSingletonScope();
    bind(PluginDeployerResolver).toService(GitpodPluginResolver);
    rebind(PluginPathsService).to(GitpodPluginPathService).inSingletonScope();

    bind(OpenVSXExtensionProviderImpl).toSelf().inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler<any>(openVSXExtensionProviderPath, () =>
            ctx.container.get(OpenVSXExtensionProviderImpl)
        )
    ).inSingletonScope();

    // GitpodInfoService
    bind(GitpodInfoProviderNodeImpl).toSelf().inSingletonScope();
    bind(ConnectionHandler).toDynamicValue(ctx =>
        new JsonRpcConnectionHandler<any>(gitpodInfoPath, client => {
            const service = ctx.container.get(GitpodInfoProviderNodeImpl)
            return service;
        })
    ).inSingletonScope();
});
