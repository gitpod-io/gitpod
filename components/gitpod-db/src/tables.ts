/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { injectable } from "inversify";

export interface TableDependency {
    table: string;
    fields: string[];
}

export interface TableDescription {
    name: string;
    primaryKeys: string[];
    timeColumn: string;
    dependencies?: string[];
    expiryColumn?: string;
    deletionColumn?: string;
    ignoreColumns?: string[];
}

export interface TableDescriptionProvider {
    readonly name: string;
    getSortedTables(): TableDescription[];
}

export const TableDescriptionProvider = Symbol("TableDescriptionProvider");

@injectable()
export class GitpodTableDescriptionProvider implements TableDescriptionProvider {
    readonly name = "gitpod";
    protected readonly tables: TableDescription[] = [
        {
            name: "d_b_workspace_cluster",
            primaryKeys: ["name"],
            timeColumn: "_lastModified",
            deletionColumn: "deleted",
        },
        {
            name: "d_b_oauth_auth_code_entry",
            primaryKeys: ["id"],
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_installation_admin",
            primaryKeys: ["id"],
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_volume_snapshot",
            primaryKeys: ["id"],
            timeColumn: "_lastModified",
            deletionColumn: "deleted",
        },
        {
            name: "d_b_blocked_repository",
            primaryKeys: ["id"],
            timeColumn: "updatedAt",
            deletionColumn: "deleted",
        },
        {
            name: "d_b_identity",
            primaryKeys: ["authProviderId", "authId"],
            timeColumn: "_lastModified",
            deletionColumn: "deleted",
            dependencies: ["d_b_user"],
        },
        {
            name: "d_b_user",
            primaryKeys: ["id"],
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_user_storage_resource",
            primaryKeys: ["userId", "uri"],
            timeColumn: "_lastModified",
            deletionColumn: "deleted",
            dependencies: ["d_b_user"],
        },
        {
            name: "d_b_workspace_instance_user",
            primaryKeys: ["instanceId", "userId"],
            timeColumn: "_lastModified",
            dependencies: ["d_b_user"],
        },
        {
            name: "d_b_workspace_report_entry",
            primaryKeys: ["uid"],
            timeColumn: "time",
            dependencies: [],
        },
        {
            name: "d_b_snapshot",
            primaryKeys: ["id"],
            timeColumn: "creationTime",
            dependencies: [],
        },
        {
            name: "d_b_email_domain_filter",
            primaryKeys: ["domain"],
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_app_installation",
            primaryKeys: ["platform", "installationID", "state"],
            timeColumn: "creationTime",
        },
        {
            name: "d_b_token_entry",
            primaryKeys: ["uid"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_user_env_var",
            primaryKeys: ["id", "userId"],
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_gitpod_token",
            primaryKeys: ["tokenHash"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
            dependencies: ["d_b_user"],
        },
        {
            name: "d_b_one_time_secret",
            primaryKeys: ["id"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_auth_provider_entry",
            primaryKeys: ["id"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_code_sync_collection",
            primaryKeys: ["userId", "collection"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_code_sync_resource",
            primaryKeys: ["userId", "kind", "rev", "collection"],
            deletionColumn: "deleted",
            timeColumn: "created",
            dependencies: ["d_b_code_sync_collection"],
        },
        {
            name: "d_b_team",
            primaryKeys: ["id"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_team_membership",
            primaryKeys: ["id"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_team_membership_invite",
            primaryKeys: ["id"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_project",
            primaryKeys: ["id"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_project_env_var",
            primaryKeys: ["id", "projectId"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_project_info",
            primaryKeys: ["projectId"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_project_usage",
            primaryKeys: ["projectId"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_user_ssh_public_key",
            primaryKeys: ["id"],
            deletionColumn: "deleted",
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_cost_center",
            primaryKeys: ["id", "creationTime"],
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_usage",
            primaryKeys: ["id"],
            timeColumn: "_lastModified",
        },
        {
            name: "d_b_stripe_customer",
            primaryKeys: ["stripeCustomerId"],
            timeColumn: "_lastModified",
            deletionColumn: "deleted",
        },
        {
            name: "d_b_personal_access_token",
            primaryKeys: ["id"],
            timeColumn: "_lastModified",
            deletionColumn: "deleted",
        },
        {
            name: "d_b_linked_in_profile",
            primaryKeys: ["id"],
            timeColumn: "_lastModified",
        },
    ];

    public getSortedTables(): TableDescription[] {
        return new TopologicalSort<string, TableDescription>().sort(
            this.tables,
            (t) => t.name,
            (t) => (t.dependencies || []).map((e) => this.tables.find((te) => te.name == e)!),
        );
    }
}

class TopologicalSort<K, E> {
    protected result: E[] = [];
    protected visitedNodes: Map<K, boolean>;

    public sort(values: E[], key: (e: E) => K, edge: (e: E) => E[]): E[] {
        this.visitedNodes = new Map<K, boolean>();
        this.result = [];

        for (const e of values) {
            const k = key(e);
            const priorVisit = this.visitedNodes.get(k);
            if (priorVisit === undefined) {
                this.visit(e, key, edge);
            }
        }

        return this.result;
    }

    protected visit(e: E, key: (e: E) => K, edges: (e: E) => E[]) {
        if (this.isMarkedPermanently(key(e))) return;
        if (this.isMarkedTemporarily(key(e))) {
            throw new Error("Circle detected in " + key);
        }

        this.visitedNodes.set(key(e), false);
        edges(e).forEach((edge) => this.visit(edge, key, edges));
        this.visitedNodes.set(key(e), true);
        this.result.push(e);
    }

    protected isMarkedPermanently(k: K) {
        return this.visitedNodes.get(k) === true;
    }

    protected isMarkedTemporarily(k: K) {
        return this.visitedNodes.get(k) === false;
    }

    protected isUnmarked(k: K) {
        return this.visitedNodes.get(k) === undefined;
    }
}
