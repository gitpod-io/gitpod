/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { inject, injectable } from "inversify";
import { ConfigurationService as ConfigurationServiceInterface } from "@gitpod/public-api/lib/gitpod/experimental/v2/configuration_connect";
import {
    CreateConfigurationRequest,
    CreateConfigurationResponse,
    DeleteConfigurationRequest,
    DeleteConfigurationResponse,
    GetConfigurationRequest,
    GetConfigurationResponse,
    ListConfigurationsRequest,
    ListConfigurationsResponse,
} from "@gitpod/public-api/lib/gitpod/experimental/v2/configuration_pb";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/experimental/v2/pagination_pb";
import { ProjectsService } from "../projects/projects-service";

@injectable()
export class ConfigurationServiceAPI implements ServiceImpl<typeof ConfigurationServiceInterface> {
    constructor(
        @inject(ProjectsService)
        private readonly projectService: ProjectsService,
        @inject(PublicAPIConverter)
        private readonly apiConverter: PublicAPIConverter,
    ) {}

    async createConfiguration(
        req: CreateConfigurationRequest,
        context: HandlerContext,
    ): Promise<CreateConfigurationResponse> {
        if (!req.organizationId) {
            throw new Error("organizationId is required");
        }
        if (!req.cloneUrl) {
            throw new Error("cloneUrl is required");
        }
        if (!req.name) {
            throw new Error("name is required");
        }
        const project = await this.projectService.createProject(
            {
                teamId: req.organizationId,
                name: req.name,
                cloneUrl: req.cloneUrl,
                appInstallationId: "",
                slug: "",
            },
            context.user,
        );
        return new CreateConfigurationResponse({
            configuration: this.apiConverter.toConfiguration(project),
        });
    }
    async getConfiguration(req: GetConfigurationRequest, context: HandlerContext): Promise<GetConfigurationResponse> {
        if (!req.configurationId) {
            throw new Error("configurationId is required");
        }
        const project = await this.projectService.getProject(context.user.id, req.configurationId);
        return new GetConfigurationResponse({
            configuration: this.apiConverter.toConfiguration(project),
        });
    }

    async listConfigurations(
        req: ListConfigurationsRequest,
        context: HandlerContext,
    ): Promise<ListConfigurationsResponse> {
        if (!req.organizationId) {
            throw new Error("organizationId is required");
        }
        const projects = await this.projectService.getProjects(context.user.id, req.organizationId);
        return new ListConfigurationsResponse({
            configurations: projects.map((p) => this.apiConverter.toConfiguration(p)),
            pagination: new PaginationResponse({
                total: projects.length,
            }),
        });
    }

    async deleteConfiguration(
        req: DeleteConfigurationRequest,
        context: HandlerContext,
    ): Promise<DeleteConfigurationResponse> {
        if (!req.configurationId) {
            throw new Error("configurationId is required");
        }
        await this.projectService.deleteProject(context.user.id, req.configurationId);
        return new DeleteConfigurationResponse();
    }
}
