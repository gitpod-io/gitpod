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
    UpdateConfigurationRequest,
    UpdateConfigurationResponse,
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
        if (!req.organizationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "organization_id is required");
        }

        const limit = req.pagination?.pageSize || 25;
        const currentPage = req.pagination?.page ?? 1;
        const offset = currentPage > 1 ? (currentPage - 1) * limit : 0;

        const { rows, total } = await this.projectService.findProjects(context.user.id, {
            organizationId: req.organizationId,
            searchTerm: req.searchTerm,
            orderBy: "name",
            orderDir: "ASC",
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

    async updateConfiguration(req: UpdateConfigurationRequest, handler: HandlerContext) {
        if (!req.configuration?.id) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configuration_id is required");
        }

        // let branchStrategy: PrebuildSettings["branchStrategy"];
        // switch (req.configuration?.prebuildSettings?.branchStrategy) {
        //     case BranchMatchingStrategy.DEFAULT_BRANCH: {
        //         branchStrategy = "default-branch";
        //         break;
        //     }
        //     case BranchMatchingStrategy.ALL_BRANCHES: {
        //         branchStrategy = "all-branches";
        //         break;
        //     }
        //     case BranchMatchingStrategy.MATCHED_BRANCHES: {
        //         branchStrategy = "matched-branches";
        //         break;
        //     }
        // }

        await this.projectService.updateProject(handler.user, {
            id: req.configuration.id,
            name: req.configuration.name,
            cloneUrl: req.configuration.cloneUrl,
            teamId: req.configuration.organizationId,
            creationTime: req.configuration.creationTime?.toDate().toString(),
            // settings: {
            //     prebuilds: {
            //         enable: req.configuration.prebuildSettings?.enabled,
            //         prebuildInterval: req.configuration.prebuildSettings?.prebuildInterval,
            //         branchStrategy,
            //         branchMatchingPattern: req.configuration.prebuildSettings?.branchMatchingPattern,
            //         workspaceClass: req.configuration.prebuildSettings?.workspaceClass,
            //     },
            //     workspaceClasses: {
            //         regular: req.configuration.workspaceSettings?.workspaceClass,
            //     },
            // },
        });

        return new UpdateConfigurationResponse();
    }

    async deleteConfiguration(req: DeleteConfigurationRequest, handler: HandlerContext) {
        if (!req.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configuration_id is required");
        }

        await this.projectService.deleteProject(handler.user.id, req.configurationId);

        return new DeleteConfigurationResponse();
    }
}
