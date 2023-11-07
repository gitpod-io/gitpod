/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { inject, injectable } from "inversify";
import { ConfigurationService as ConfigurationServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/configuration_connect";
import { PublicAPIConverter } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { ProjectsService } from "../projects/projects-service";
import {
    CreateConfigurationRequest,
    CreateConfigurationResponse,
    DeleteConfigurationRequest,
    DeleteConfigurationResponse,
    GetConfigurationRequest,
    ListConfigurationsRequest,
    ListConfigurationsResponse,
} from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";

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
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }
        if (!req.cloneUrl) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "cloneUrl is required");
        }
        if (!req.name) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "name is required");
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

    async getConfiguration(req: GetConfigurationRequest, context: HandlerContext) {
        if (!req.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configurationId is required");
        }

        const project = await this.projectService.getProject(context.user.id, req.configurationId);

        return {
            configuration: this.apiConverter.toConfiguration(project),
        };
    }

    async listConfigurations(req: ListConfigurationsRequest, context: HandlerContext) {
        if (!req.organizationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }

        const { rows, total } = await this.projectService.findProjects(context.user.id, {
            searchTerm: req.searchTerm,
            orderBy: "name",
            orderDir: "ASC",
            limit: req.pagination?.pageSize || 25,
            offset: req.pagination?.page || 0,
        });

        return new ListConfigurationsResponse({
            configurations: rows.map((project) => this.apiConverter.toConfiguration(project)),
            pagination: new PaginationResponse({
                total,
            }),
        });
    }

    async deleteConfiguration(req: DeleteConfigurationRequest, handler: HandlerContext) {
        if (!req.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configurationId is required");
        }

        await this.projectService.deleteProject(handler.user.id, req.configurationId);

        return new DeleteConfigurationResponse();
    }
}
