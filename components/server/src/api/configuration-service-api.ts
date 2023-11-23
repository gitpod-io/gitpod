/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { HandlerContext, ServiceImpl } from "@connectrpc/connect";
import { inject, injectable } from "inversify";
import { ConfigurationService as ConfigurationServiceInterface } from "@gitpod/public-api/lib/gitpod/v1/configuration_connect";
import { PublicAPIConverter, PartialConfiguration } from "@gitpod/gitpod-protocol/lib/public-api-converter";
import { ProjectsService } from "../projects/projects-service";
import {
    Configuration,
    CreateConfigurationRequest,
    CreateConfigurationResponse,
    DeleteConfigurationRequest,
    DeleteConfigurationResponse,
    GetConfigurationRequest,
    ListConfigurationsRequest,
    ListConfigurationsResponse,
    PrebuildSettings,
    UpdateConfigurationRequest,
    WorkspaceSettings,
} from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { PaginationResponse } from "@gitpod/public-api/lib/gitpod/v1/pagination_pb";
import { ApplicationError, ErrorCodes } from "@gitpod/gitpod-protocol/lib/messaging/error";
import { validate as uuidValidate } from "uuid";
import { PaginationToken, generatePaginationToken, parsePaginationToken } from "./pagination";
import { ctxUserId } from "../util/request-context";
import { UserService } from "../user/user-service";
import { SortOrder } from "@gitpod/public-api/lib/gitpod/v1/sorting_pb";
import { Project } from "@gitpod/gitpod-protocol";
import { DeepPartial } from "@gitpod/gitpod-protocol/lib/util/deep-partial";

function buildUpdateObject<T extends Record<string, any>>(obj: T): Partial<T> {
    const update: Partial<T> = {};
    Object.keys(obj).forEach((key) => {
        const property = obj[key];
        if (property !== undefined) {
            if (property !== null && typeof property === "object" && !Array.isArray(property)) {
                // Recursively build update object for nested properties
                update[key as keyof T] = buildUpdateObject(property) as any;
            } else {
                update[key as keyof T] = property;
            }
        }
    });
    return update;
}

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

        // grab the first sort entry - only 1 supported here
        const sort = req.sort?.[0];
        // defaults to name
        const orderBy = sort?.field || "name";
        const sortOrder = sort?.order || SortOrder.ASC;
        // defaults to ascending
        const orderDir: "ASC" | "DESC" = sortOrder === SortOrder.DESC ? "DESC" : "ASC";

        if (!["name", "creationTime"].includes(orderBy as string)) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "orderBy must be one of 'name' or 'creationTime'");
        }

        const { rows } = await this.projectService.findProjects(ctxUserId(), {
            organizationId: req.organizationId,
            searchTerm: req.searchTerm,
            orderBy: orderBy as keyof Project,
            orderDir,
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

    async updateConfiguration(req: UpdateConfigurationRequest, _: HandlerContext) {
        if (!req.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configuration_id is required");
        }

        const userId = ctxUserId();
        const installer = await this.userService.findUserById(userId, userId);
        if (!installer) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "user not found");
        }

        const update: PartialConfiguration = {
            id: req.configurationId,
        };

        if (typeof req.name === "string") {
            update.name = req.name;
        }

        if (req.prebuildSettings !== undefined) {
            update.prebuildSettings = buildUpdateObject<DeepPartial<PrebuildSettings>>(req.prebuildSettings);
        }

        if (req.workspaceSettings !== undefined) {
            update.workspaceSettings = buildUpdateObject<DeepPartial<WorkspaceSettings>>(req.workspaceSettings);
        }

        if (Object.keys(update).length <= 1) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "nothing to update");
        }

        const project = this.apiConverter.fromPartialConfiguration(update);

        const updatedProject = await this.projectService.updateProject(installer, project);

        return {
            configuration: this.apiConverter.toConfiguration(updatedProject),
        };
    }

    async updateConfiguration(req: UpdateConfigurationRequest, _: HandlerContext) {
        if (!req.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configuration_id is required");
        }

        const userId = ctxUserId();
        const installer = await this.userService.findUserById(userId, userId);
        if (!installer) {
            throw new ApplicationError(ErrorCodes.NOT_FOUND, "user not found");
        }

        const configuration = new Configuration();
        configuration.id = req.configurationId;
        configuration.name = req.name;
        configuration.prebuildSettings = new PrebuildSettings(req.prebuildSettings);
        configuration.workspaceSettings = new Workspace(req.workspaceSettings);

        const project = this.apiConverter.fromConfiguration(configuration);

        const updatedProject = await this.projectService.updateProject(installer, project);

        return {
            configuration: this.apiConverter.toConfiguration(updatedProject),
        };
    }

    async deleteConfiguration(req: DeleteConfigurationRequest, _: HandlerContext) {
        if (!req.configurationId) {
            throw new ApplicationError(ErrorCodes.BAD_REQUEST, "configuration_id is required");
        }

        await this.projectService.deleteProject(ctxUserId(), req.configurationId);

        return new DeleteConfigurationResponse();
    }
}
