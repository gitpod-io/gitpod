package query_test

import (
	"database/sql"
	"fmt"
	"os"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/gitpod-io/gitpod/dbfga/pkg/query"
)

func TestModel(t *testing.T) {
	m := query.NewModel()

	m.Type("user", "d_b_user", "id").
		Rel("owner", query.OpExists("d_b_user", "id", m.ValActor)).
		Rel("writer", query.Ref("user", "owner")).
		Rel("reader", query.OpOr(
			query.Ref("user", "writer"),
			query.Ref("user", "owner"),
		))

	m.Type("workspace", "d_b_workspace", "id").
		Rel("owner", query.OpRel(
			query.Ref("user", "owner"),
			"d_b_user", "id", "d_b_workspace", "ownerId",
		)).
		Rel("access", query.OpOr(
			query.Ref("workspace", "owner"),

			// everyone gets access if the workspace is shareable
			query.OpExists("d_b_workspace", "shareable", func() string { return "1" }),
		))

	m.Type("workspace_instance", "d_b_workspace_instance", "id").
		Rel("owner", query.OpRel(
			query.Ref("workspace", "owner"),
			"d_b_workspace", "id",
			"d_b_workspace_instance", "workspaceId",
		)).
		Rel("access", query.OpOr(
			query.Ref("workspace_instance", "owner"),
			query.OpRel(
				query.Ref("workspace", "access"),
				"d_b_workspace", "id",
				"d_b_workspace_instance", "workspaceId",
			),
		))

	err := m.Link()
	if err != nil {
		t.Fatal(err)
	}

	fmt.Println("------\nModel:")
	m.Describe(os.Stdout)

	os.Remove("test.db")
	db, err := sql.Open("sqlite", "file:test.db")
	if err != nil {
		t.Fatal(err)
	}

	must(db.Query("CREATE TABLE d_b_user (id string)"))
	must(db.Query("CREATE TABLE d_b_workspace (id string, ownerId string, shareable bool)"))
	must(db.Query("CREATE TABLE d_b_workspace_instance (id string, workspaceId string)"))

	canUserAccessWorkspaceInstance := must(m.PrepareQuery(db, "user", "access", "workspace_instance"))

	fmt.Printf("\n------\nQuery:\n  %v\n", canUserAccessWorkspaceInstance)

	fmt.Printf("\n------Experiments:\nbefore insert:\n")
	fmt.Printf("  can user:foo access instance:bar? %v\n", must(canUserAccessWorkspaceInstance.Eval("foo", "bar")))
	fmt.Printf("  can user:foo access instance:shared? %v\n", must(canUserAccessWorkspaceInstance.Eval("foo", "shared")))

	must(db.Query("INSERT INTO d_b_user VALUES (\"foo\")"))
	must(db.Query("INSERT INTO d_b_user VALUES (\"noowner\")"))
	must(db.Query("INSERT INTO d_b_workspace VALUES (\"myws\", \"foo\", false)"))
	must(db.Query("INSERT INTO d_b_workspace_instance VALUES (\"bar\", \"myws\")"))
	must(db.Query("INSERT INTO d_b_workspace VALUES (\"otherws\", \"notFoo\", true)"))
	must(db.Query("INSERT INTO d_b_workspace_instance VALUES (\"shared\", \"otherws\")"))
	fmt.Printf("\nafter insert:\n")
	fmt.Printf("  can user:foo access instance:bar? %v\n", must(canUserAccessWorkspaceInstance.Eval("foo", "bar")))
	fmt.Printf("  can user:noowner access instance:bar? %v\n", must(canUserAccessWorkspaceInstance.Eval("noowner", "bar")))
	fmt.Printf("  can user:foo access instance:shared? %v\n", must(canUserAccessWorkspaceInstance.Eval("foo", "shared")))
	fmt.Printf("  can user:noowner access instance:shared? %v\n", must(canUserAccessWorkspaceInstance.Eval("noowner", "shared")))
}

func must[T any](val T, err error) T {
	if err != nil {
		panic(err)
	}
	return val
}
