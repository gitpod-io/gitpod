// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package main_test

import (
	dbgen "github.com/gitpod-io/gitpod/authorizer/pkg/dbgen"
	executor "github.com/gitpod-io/gitpod/authorizer/pkg/executor"
)

func (sess *Session) checkUserOwner(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.StartChainWithExists("user is self", "d_b_user", "id", actorKey)
}
func (sess *Session) checkUserWriter(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainOr(nil, "d_b_user", executor.StartChainWithExists("user is self", "d_b_user", "id", actorKey), sess.checkUserOwner(actorKey, subjectKey))
}
func (sess *Session) checkUserReader(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainOr(nil, "d_b_user", executor.StartChainWithExists("user is self", "d_b_user", "id", actorKey), sess.checkUserWriter(actorKey, subjectKey))
}
func (sess *Session) checkWorkspaceOwner(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.ChainParentRelation(sess.checkUserOwner(actorKey, subjectKey), "id", "d_b_workspace", "ownerId")
}
func (sess *Session) checkWorkspaceAccess(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainOr(nil, "d_b_workspace", executor.StartChainWithExists("workspace is self", "d_b_workspace", "id", actorKey), sess.checkWorkspaceOwner(actorKey, subjectKey))
}
func (sess *Session) checkWorkspaceWriter(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainOr(nil, "d_b_workspace", executor.StartChainWithExists("workspace is self", "d_b_workspace", "id", actorKey), sess.checkWorkspaceOwner(actorKey, subjectKey))
}
func (sess *Session) checkWorkspaceReader(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainOr(nil, "d_b_workspace", executor.StartChainWithExists("workspace is self", "d_b_workspace", "id", actorKey), sess.checkWorkspaceAccess(actorKey, subjectKey), sess.checkWorkspaceWriter(actorKey, subjectKey))
}
func (sess *Session) checkWorkspaceInstanceOwner(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.ChainParentRelation(sess.checkWorkspaceOwner(actorKey, subjectKey), "id", "d_b_workspace_instance", "workspaceId")
}
func (sess *Session) checkWorkspaceInstanceAccess(actorKey, subjectKey string) executor.QueryBuilder {
	return executor.GroupChainOr(nil, "d_b_workspace_instance", sess.checkWorkspaceInstanceOwner(actorKey, subjectKey), executor.ChainParentRelation(sess.checkWorkspaceAccess(actorKey, subjectKey), "id", "d_b_workspace_instance", "workspaceId"))
}

var types = map[string]dbgen.TypeSpec{
	"user": {
		IDColumn: "id",
		Table:    "d_b_user",
	},
	"workspace": {
		IDColumn: "id",
		Table:    "d_b_workspace",
	},
	"workspace_instance": {
		IDColumn: "id",
		Table:    "d_b_workspace_instance",
	},
}

func (sess *Session) Check(actor, rel, subject string) (executor.QueryBuilder, error) {
	actorType, actorKey, err := executor.SplitObj(actor)
	if err != nil {
		return nil, err
	}
	subjectType, subjectKey, err := executor.SplitObj(subject)
	if err != nil {
		return nil, err
	}

	var res executor.QueryBuilder
	switch {
	case subjectType == "user" && rel == "owner":
		res = sess.checkUserOwner(actorKey, subjectKey)
	case subjectType == "user" && rel == "writer":
		res = sess.checkUserWriter(actorKey, subjectKey)
	case subjectType == "user" && rel == "reader":
		res = sess.checkUserReader(actorKey, subjectKey)
	case subjectType == "workspace" && rel == "owner":
		res = sess.checkWorkspaceOwner(actorKey, subjectKey)
	case subjectType == "workspace" && rel == "access":
		res = sess.checkWorkspaceAccess(actorKey, subjectKey)
	case subjectType == "workspace" && rel == "writer":
		res = sess.checkWorkspaceWriter(actorKey, subjectKey)
	case subjectType == "workspace" && rel == "reader":
		res = sess.checkWorkspaceReader(actorKey, subjectKey)
	case subjectType == "workspace_instance" && rel == "owner":
		res = sess.checkWorkspaceInstanceOwner(actorKey, subjectKey)
	case subjectType == "workspace_instance" && rel == "access":
		res = sess.checkWorkspaceInstanceAccess(actorKey, subjectKey)
	}

	actorTpe := types[actorType]
	subjectTpe := types[subjectType]
	return executor.GroupChainAnd(res, "", res, executor.StartChainWithExists("checkActorExists", actorTpe.Table, actorTpe.IDColumn, actorKey), executor.StartChainWithExists("checkSubjectExists", subjectTpe.Table, subjectTpe.IDColumn, subjectKey)), nil
}

type Session struct {
	DB executor.DB
}
