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
import { validate as uuidValidate } from "uuid";
import { PaginationToken, generatePaginationToken, parsePaginationToken } from "./pagination";

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
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organization_id is required");
        }
        if (!req.cloneUrl) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "clone_url is required");
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
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configuration_id is required");
        }

        const project = await this.projectService.getProject(context.user.id, req.configurationId);

        return {
            configuration: this.apiConverter.toConfiguration(project),
        };
    }

    async listConfigurations(req: ListConfigurationsRequest, context: HandlerContext) {
        // TODO: encapsulate this validation into some more generic schema validation
        const limit = req.pagination?.pageSize || 25;
        if (limit > 100) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "pageSize must be less than 100");
        }
        if (limit < 25) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "pageSize must be greater than 25");
        }
        if ((req.searchTerm || "").length > 100) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "searchTerm must be less than 100 characters");
        }
        if (!uuidValidate(req.organizationId)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organizationId is required");
        }

        const paginationToken = parsePaginationToken(req.pagination?.token);

        const { rows } = await this.projectService.findProjects(context.user.id, {
            organizationId: req.organizationId,
            searchTerm: req.searchTerm,
            // TODO: support sorting params from req.pagination
            orderBy: "name",
            orderDir: "ASC",
            // We request 1 additional record to help determine if there are more results
            limit: limit + 1,
            offset: paginationToken.offset,
        });

        // Drop the extra record we requested to determine if there are more results
        const pagedRows = rows.slice(0, limit);

        const response = new ListConfigurationsResponse({
            configurations: pagedRows.map((project) => this.apiConverter.toConfiguration(project)),
        });
        response.pagination = new PaginationResponse();

        // If we got back an extra row, it means there are more results
        if (rows.length > limit) {
            const nextToken: PaginationToken = {
                offset: paginationToken.offset + limit,
            };

            response.pagination.nextToken = generatePaginationToken(nextToken);
        }

        return response;
    }

    async deleteConfiguration(req: DeleteConfigurationRequest, handler: HandlerContext) {
        if (!req.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configuration_id is required");
        }

        await this.projectService.deleteProject(handler.user.id, req.configurationId);

        return new DeleteConfigurationResponse();
    }
}
