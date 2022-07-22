// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/gitpod-io/gitpod/authorizer/pkg/executor"
)

func checkUserSelf(actorKey, subjectKey string) executor.QueryBuilder {
	// is self
	return executor.GroupChainAnd(nil, "d_b_user",
		// executor.StartChainWithIdentity(actorKey, subjectKey),
		executor.StartChainWithExists("checkUserSelf", "d_b_user", "id", actorKey),
	)
}

func checkUserOwner(actorKey, subjectKey string) executor.QueryBuilder {
	return checkUserSelf(actorKey, subjectKey)
}

func checkUserWriter(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainAnd(nil, "",
		// checkUserSelf(actorKey, subjectKey),
		checkUserOwner(actorKey, subjectKey),
	)
}

func checkUserReader(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainOr(nil, "d_b_user",
		checkUserSelf(actorKey, subjectKey),
		checkUserWriter(actorKey, subjectKey),
	)
}

func checkWorkspaceOwner(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.ChainParentRelation(
		checkUserOwner(actorKey, subjectKey),
		"id", // rt.Target.IDColumn
		"d_b_workspace",
		"ownerId",
	)
}

func checkWorkspaceSelf(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainAnd(nil, "d_b_workspace",
		executor.StartChainWithIdentity(actorKey, subjectKey),
		executor.StartChainWithExists("checkWorkspaceSelf", "d_b_workspace", "id", subjectKey),
	)
}

func checkWorkspaceAccess(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainOr(nil, "d_b_workspace",
		checkWorkspaceSelf(actorKey, subjectKey),
		checkWorkspaceOwner(actorKey, subjectKey),
	)
}

func checkWorkspaceWriter(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainOr(nil, "d_b_workspace",
		checkWorkspaceSelf(actorKey, subjectKey),
		checkWorkspaceOwner(actorKey, subjectKey),
	)
}

func checkWorkspaceReader(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainOr(nil, "d_b_workspace",
		checkWorkspaceOwner(actorKey, subjectKey),
		checkWorkspaceWriter(actorKey, subjectKey),
	)
}

func checkWorkspaceInstanceOwner(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.ChainParentRelation(
		checkWorkspaceOwner(actorKey, subjectKey), // checkFuncName(rt.Target)
		"id",                     // rt.Target.IDColumn
		"d_b_workspace_instance", // type.Table
		"workspaceId",            // rt.RelationColumn
	)
}

func checkWorkspaceInstanceAccess(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainOr(nil, "d_b_workspace_instance",
		checkWorkspaceInstanceOwner(actorKey, subjectKey),
		executor.ChainParentRelation(
			checkWorkspaceAccess(actorKey, subjectKey), // checkFuncName(rt.Target)
			"id",                     // rt.Target.IDColumn
			"d_b_workspace_instance", // type.Table
			"workspaceId",            // rt.RelationColumn
		),
	)
}

func main() {
	q := checkWorkspaceInstanceOwner("userfoo", "instancebla")
	q = executor.GroupChainAnd(q, "d_b_workspace_instance",
		executor.StartChainWithExists("subject exists", "d_b_workspace_instance", "id", "instancebla"),
		q,
	)
	json.NewEncoder(os.Stdout).Encode(q)

	res := executor.NewQuery(&executor.Namespace{}, "")
	executor.Build(q, res)
	res.NormalizeValues()
	res.DangerousInsertValues()
	json.NewEncoder(os.Stdout).Encode(res)

	sql, _ := res.SQL()
	fmt.Println()
	fmt.Println(sql)
}
