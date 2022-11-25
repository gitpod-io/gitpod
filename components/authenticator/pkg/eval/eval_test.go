package eval

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gitpod-io/gitpod/authenticator/pkg/policy"
	"github.com/gitpod-io/gitpod/authenticator/pkg/resourcegraph"
	"github.com/google/go-cmp/cmp"
)

func TestFixtures(t *testing.T) {
	files, err := os.ReadDir("fixtures")
	if err != nil {
		t.Fatal(err)
	}

	for _, f := range files {
		if !strings.HasSuffix(f.Name(), ".json") {
			continue
		}

		t.Run(f.Name(), func(t *testing.T) {
			fc, err := os.ReadFile(filepath.Join("fixtures", f.Name()))
			if err != nil {
				t.Fatalf("cannot read fixture: %v", err)
			}
			var test policyTest
			test.Name = strings.TrimSuffix(f.Name(), filepath.Ext(f.Name()))
			err = json.Unmarshal(fc, &test)
			if err != nil {
				t.Fatalf("cannot unmarshal fixture: %v", err)
			}

			test.Test(t)
		})
	}
}

type query struct {
	Expectation bool                   `json:"expectation"`
	Subject     policy.ResourceName    `json:"subject"`
	Action      policy.Action          `json:"action"`
	Resource    policy.ResourceSegment `json:"resource"`
}

type policyTest struct {
	Name      string                                  `json:"-"`
	Policies  map[policy.ResourceName][]policy.Policy `json:"policies"`
	Resources []policy.ResourceName                   `json:"resources"`
	Queries   []query

	ProduceReport bool `json:"-"`
}

func (p policyTest) Test(t *testing.T) {
	var debugger *policyTestDebugger
	if p.ProduceReport {
		tmpdir, err := os.MkdirTemp("", "policy-test-debugger-*")
		if err != nil {
			t.Fatalf("cannot create tempdir for debugger: %v", err)
		}
		debugger = &policyTestDebugger{Loc: tmpdir}
		t.Logf("debug output: %s", debugger.Loc)
	}

	policies := policy.NewMemoryStore()
	for subj, p := range p.Policies {
		err := policies.Add(subj, p)
		if err != nil {
			t.Fatal(err)
		}
	}
	_ = debugger.DumpPolicies(policies)

	graph := resourcegraph.NewMemoryStore()
	for _, rn := range p.Resources {
		err := graph.Add(rn)
		if err != nil {
			t.Fatalf("cannot add resource %s: %v", rn, err)
		}
	}
	_ = debugger.DumpGraph(graph)

	evaluator := &Evaluator{
		Policies: policies,
		Graph:    graph,
	}

	_ = debugger.DumpQueries(&p.Queries)
	for _, q := range p.Queries {
		name := fmt.Sprintf("can %s do %s on %s expected %v", q.Subject, q.Action, q.Resource, q.Expectation)
		t.Run(name, func(t *testing.T) {
			ctx := context.TODO()
			act, err := evaluator.IsAllowed(ctx, q.Subject, q.Action, q.Resource)
			if err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(q.Expectation, act); diff != "" {
				t.Errorf("IsAllowed() mismatch (-want +got):\n%s", diff)
			}
		})
	}

	dbgFN := filepath.Join("/tmp/eval_test", strings.ReplaceAll(p.Name, " ", "_")+".md")
	_ = debugger.Render(dbgFN, p.Name)
	t.Logf("report in %s", dbgFN)
}

type policyTestDebugger struct {
	Loc string
}

func (ptd *policyTestDebugger) DumpGraph(g *resourcegraph.MemoryStore) error {
	if ptd == nil {
		return nil
	}

	out, err := os.OpenFile(filepath.Join(ptd.Loc, "resources.dot"), os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer out.Close()

	g.ToGraphviz(out)

	return nil
}

func (ptd *policyTestDebugger) DumpPolicies(s *policy.MemoryStore) error {
	if ptd == nil {
		return nil
	}

	fc, err := json.MarshalIndent(s.Content(), "", "  ")
	if err != nil {
		return err
	}
	err = os.WriteFile(filepath.Join(ptd.Loc, "policies.json"), fc, 0644)
	if err != nil {
		return err
	}
	return nil
}

func (ptd *policyTestDebugger) DumpQueries(s *[]query) error {
	if ptd == nil {
		return nil
	}

	fc, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	err = os.WriteFile(filepath.Join(ptd.Loc, "queries.json"), fc, 0644)
	if err != nil {
		return err
	}
	return nil
}

func (ptd *policyTestDebugger) Render(fn string, name string) error {
	if ptd == nil {
		return nil
	}

	cmd := exec.Command("dot", "-Tpng", "-oresources.png", "resources.dot")
	cmd.Dir = ptd.Loc
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%w: %s", err, string(out))
	}

	resourceImg, err := os.ReadFile(filepath.Join(ptd.Loc, "resources.png"))
	if err != nil {
		return err
	}
	policies, err := os.ReadFile(filepath.Join(ptd.Loc, "policies.json"))
	if err != nil {
		return err
	}
	queries, err := os.ReadFile(filepath.Join(ptd.Loc, "queries.json"))
	if err != nil {
		return err
	}

	html := []byte(fmt.Sprintf(`## %s

### Resources
![Hello World](data:image/png;base64,%s)

### Policies
%s

### Queries
%s
`,
		name,
		base64.StdEncoding.EncodeToString(resourceImg),
		fmt.Sprintf("```json\n%s\n```", string(policies)),
		fmt.Sprintf("```json\n%s\n```", string(queries)),
	))

	return os.WriteFile(fn, html, 0644)
}
