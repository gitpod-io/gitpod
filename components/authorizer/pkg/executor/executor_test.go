// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package executor_test

import (
	"context"
	"log"
	"testing"

	"github.com/gitpod-io/gitpod/authorizer/pkg/dbgen"
	"github.com/gitpod-io/gitpod/authorizer/pkg/executor"
)

var user = &dbgen.TypeSpec{
	Name:     "user",
	Table:    "d_b_user",
	IDColumn: "id",
	Relations: []dbgen.Relation{
		{
			Name: "owner",
			Targets: []dbgen.RelationTarget{
				dbgen.RelationSelf{},
			},
		},
		{
			Name: "writer",
			Targets: []dbgen.RelationTarget{
				dbgen.RelationSelf{},
				dbgen.RelationRef("owner"),
			},
		},
	},
}

var workspace = &dbgen.TypeSpec{
	Name:     "workspace",
	Table:    "d_b_workspace",
	IDColumn: "id",
	Relations: []dbgen.Relation{
		{
			Name: "owner",
			Targets: []dbgen.RelationTarget{
				dbgen.RelationRemoteRef{
					Target:         user,
					Name:           "owner",
					RelationColumn: "ownerId",
				},
			},
		},
		{
			Name: "access",
			Targets: []dbgen.RelationTarget{
				dbgen.RelationSelf{},
				dbgen.RelationRef("owner"),
			},
		},
		{
			Name: "writer",
			Targets: []dbgen.RelationTarget{
				dbgen.RelationSelf{},
				dbgen.RelationRef("owner"),
			},
		},
		{
			Name: "reader",
			Targets: []dbgen.RelationTarget{
				dbgen.RelationSelf{},
				dbgen.RelationRef("access"),
				dbgen.RelationRef("writer"),
				dbgen.RelationRemoteRef{
					Target:         token,
					Name:           "reader",
					RelationColumn: "ownerId",
					ActorRelColumn: "userId",
				},
			},
		},
	},
}

var workspaceInstance = &dbgen.TypeSpec{
	Name:     "workspace_instance",
	Table:    "d_b_workspace_instance",
	IDColumn: "id",
	Relations: []dbgen.Relation{
		{
			Name: "owner",
			Targets: []dbgen.RelationTarget{
				dbgen.RelationRemoteRef{
					Target:         workspace,
					Name:           "owner",
					RelationColumn: "workspaceId",
				},
			},
		},
		{
			Name: "access",
			Targets: []dbgen.RelationTarget{
				dbgen.RelationRef("owner"),
				dbgen.RelationRemoteRef{
					Target:         workspace,
					Name:           "access",
					RelationColumn: "workspaceId",
				},
			},
		},
	},
}

var token = &dbgen.TypeSpec{
	Name:     "token",
	Table:    "d_b_gitpod_token",
	IDColumn: "tokenHash",
	Relations: []dbgen.Relation{
		{
			Name: "owner",
			Targets: []dbgen.RelationTarget{
				dbgen.RelationRemoteRef{
					Target:         user,
					Name:           "owner",
					RelationColumn: "userId",
				},
			},
		},
		{
			Name: "reader",
			Targets: []dbgen.RelationTarget{
				dbgen.RelationSelfContains{
					Column:    "scopes",
					Substring: "reader",
				},
			},
		},
	},
}

func BenchmarkCheck(b *testing.B) {
	exec, err := executor.NewExecutor(
		user,
		workspace,
		workspaceInstance,
		token,
	)
	if err != nil {
		log.Fatal(err)
	}

	b.ReportAllocs()
	b.ResetTimer()
	exec.Check(context.Background(), "reader", "token:foo", "workspace:instancebla")
	// for n := 0; n < b.N; n++ {
	// }
}
