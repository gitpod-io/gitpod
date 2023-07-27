/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { v1 } from "@authzed/authzed-node";

export const InstallationID = "1";

export type ResourceType = UserResourceType | InstallationResourceType | OrganizationResourceType | ProjectResourceType;

export type Relation = UserRelation | InstallationRelation | OrganizationRelation | ProjectRelation;

export type Permission = UserPermission | InstallationPermission | OrganizationPermission | ProjectPermission;

export type UserResourceType = "user";

export type UserRelation = "self" | "container";

export type UserPermission = "read_info" | "write_info" | "suspend" | "make_admin";

export type InstallationResourceType = "installation";

export type InstallationRelation = "member" | "admin";

export type InstallationPermission = "create_organization";

export type OrganizationResourceType = "organization";

export type OrganizationRelation = "installation" | "member" | "owner";

export type OrganizationPermission =
    | "installation_admin"
    | "read_info"
    | "write_info"
    | "delete"
    | "read_settings"
    | "write_settings"
    | "read_members"
    | "invite_members"
    | "write_members"
    | "leave"
    | "create_project"
    | "read_git_provider"
    | "write_git_provider"
    | "read_billing"
    | "write_billing"
    | "write_billing_admin";

export type ProjectResourceType = "project";

export type ProjectRelation = "org" | "editor" | "viewer";

export type ProjectPermission = "read_info" | "write_info" | "delete";

export const rel = {
    user(id: string) {
        const result: Partial<v1.Relationship> = {
            resource: {
                objectType: "user",
                objectId: id,
            },
        };
        return {
            get self() {
                const result2 = {
                    ...result,
                    relation: "self",
                };
                return {
                    user(objectId: string) {
                        return {
                            ...result2,
                            subject: {
                                object: {
                                    objectType: "user",
                                    objectId: objectId,
                                },
                            },
                        } as v1.Relationship;
                    },
                };
            },

            get container() {
                const result2 = {
                    ...result,
                    relation: "container",
                };
                return {
                    organization(objectId: string) {
                        return {
                            ...result2,
                            subject: {
                                object: {
                                    objectType: "organization",
                                    objectId: objectId,
                                },
                            },
                        } as v1.Relationship;
                    },
                    get installation() {
                        return {
                            ...result2,
                            subject: {
                                object: {
                                    objectType: "installation",
                                    objectId: "1",
                                },
                            },
                        } as v1.Relationship;
                    },
                };
            },
        };
    },

    get installation() {
        const result: Partial<v1.Relationship> = {
            resource: {
                objectType: "installation",
                objectId: "1",
            },
        };
        return {
            get member() {
                const result2 = {
                    ...result,
                    relation: "member",
                };
                return {
                    user(objectId: string) {
                        return {
                            ...result2,
                            subject: {
                                object: {
                                    objectType: "user",
                                    objectId: objectId,
                                },
                            },
                        } as v1.Relationship;
                    },
                };
            },

            get admin() {
                const result2 = {
                    ...result,
                    relation: "admin",
                };
                return {
                    user(objectId: string) {
                        return {
                            ...result2,
                            subject: {
                                object: {
                                    objectType: "user",
                                    objectId: objectId,
                                },
                            },
                        } as v1.Relationship;
                    },
                };
            },
        };
    },

    organization(id: string) {
        const result: Partial<v1.Relationship> = {
            resource: {
                objectType: "organization",
                objectId: id,
            },
        };
        return {
            get installation() {
                const result2 = {
                    ...result,
                    relation: "installation",
                };
                return {
                    get installation() {
                        return {
                            ...result2,
                            subject: {
                                object: {
                                    objectType: "installation",
                                    objectId: "1",
                                },
                            },
                        } as v1.Relationship;
                    },
                };
            },

            get member() {
                const result2 = {
                    ...result,
                    relation: "member",
                };
                return {
                    user(objectId: string) {
                        return {
                            ...result2,
                            subject: {
                                object: {
                                    objectType: "user",
                                    objectId: objectId,
                                },
                            },
                        } as v1.Relationship;
                    },
                };
            },

            get owner() {
                const result2 = {
                    ...result,
                    relation: "owner",
                };
                return {
                    user(objectId: string) {
                        return {
                            ...result2,
                            subject: {
                                object: {
                                    objectType: "user",
                                    objectId: objectId,
                                },
                            },
                        } as v1.Relationship;
                    },
                };
            },
        };
    },

    project(id: string) {
        const result: Partial<v1.Relationship> = {
            resource: {
                objectType: "project",
                objectId: id,
            },
        };
        return {
            get org() {
                const result2 = {
                    ...result,
                    relation: "org",
                };
                return {
                    organization(objectId: string) {
                        return {
                            ...result2,
                            subject: {
                                object: {
                                    objectType: "organization",
                                    objectId: objectId,
                                },
                            },
                        } as v1.Relationship;
                    },
                };
            },

            get editor() {
                const result2 = {
                    ...result,
                    relation: "editor",
                };
                return {
                    user(objectId: string) {
                        return {
                            ...result2,
                            subject: {
                                object: {
                                    objectType: "user",
                                    objectId: objectId,
                                },
                            },
                        } as v1.Relationship;
                    },
                };
            },

            get viewer() {
                const result2 = {
                    ...result,
                    relation: "viewer",
                };
                return {
                    user(objectId: string) {
                        return {
                            ...result2,
                            subject: {
                                object: {
                                    objectType: "user",
                                    objectId: objectId,
                                },
                            },
                        } as v1.Relationship;
                    },
                    organization(objectId: string) {
                        return {
                            ...result2,
                            subject: {
                                object: {
                                    objectType: "organization",
                                    objectId: objectId,
                                },
                            },
                        } as v1.Relationship;
                    },
                };
            },
        };
    },
};
