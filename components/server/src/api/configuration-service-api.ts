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
import { ctxUserId } from "../util/request-context";
import { UserService } from "../user/user-service";
import { SortOrder } from "@gitpod/public-api/lib/gitpod/v1/sorting_pb";
import { Project } from "@gitpod/gitpod-protocol";

@injectable()
export class ConfigurationServiceAPI implements ServiceImpl<typeof ConfigurationServiceInterface> {
    constructor(
        @inject(ProjectsService)
        private readonly projectService: ProjectsService,
        @inject(PublicAPIConverter)
        private readonly apiConverter: PublicAPIConverter,
        @inject(UserService)
        private readonly userService: UserService,
    ) {}

    async createConfiguration(
        req: CreateConfigurationRequest,
        _: HandlerContext,
    ): Promise<CreateConfigurationResponse> {
        if (!req.organizationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organization_id is required");
        }
        if (!req.cloneUrl) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "clone_url is required");
        }

        const installer = await this.userService.findUserById(ctxUserId(), ctxUserId());
        if (!installer) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "user not found");
        }

        const project = await this.projectService.createProject(
            {
                teamId: req.organizationId,
                name: req.name,
                cloneUrl: req.cloneUrl,
                appInstallationId: "",
                slug: "",
            },
            installer,
        );

        return new CreateConfigurationResponse({
            configuration: this.apiConverter.toConfiguration(project),
        });
    }

    async getConfiguration(req: GetConfigurationRequest, _: HandlerContext) {
        if (!req.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configuration_id is required");
        }

        const project = await this.projectService.getProject(ctxUserId(), req.configurationId);

        return {
            configuration: this.apiConverter.toConfiguration(project),
        };
    }

    async listConfigurations(req: ListConfigurationsRequest, _: HandlerContext) {
        if (!req.organizationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organization_id is required");
        }

        const limit = req.pagination?.pageSize || 25;
        const currentPage = req.pagination?.page ?? 1;
        const offset = currentPage > 1 ? (currentPage - 1) * limit : 0;

        const sort = req.sort?.[0];

        // validate orderBy and orderDir
        const orderBy = sort?.field || "name";
        const sortOrder = sort?.order || SortOrder.ASC;
        const orderDir: "ASC" | "DESC" = sortOrder === SortOrder.DESC ? "DESC" : "ASC";

        const { rows, total } = await this.projectService.findProjects(ctxUserId(), {
            organizationId: req.organizationId,
            searchTerm: req.searchTerm,
            orderBy: orderBy as keyof Project,
            orderDir,
            limit,
            offset,
        });

        return new ListConfigurationsResponse({
            configurations: rows.map((project) => this.apiConverter.toConfiguration(project)),
            // TODO: add additional pagination metadata to response
            pagination: new PaginationResponse({
                total,
            }),
        });
    }

    async deleteConfiguration(req: DeleteConfigurationRequest, _: HandlerContext) {
        if (!req.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configuration_id is required");
        }

        await this.projectService.deleteProject(ctxUserId(), req.configurationId);

        return new DeleteConfigurationResponse();
    }
}
