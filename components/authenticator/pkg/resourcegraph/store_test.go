package resourcegraph

import (
	"testing"

	"github.com/gitpod-io/gitpod/authenticator/pkg/policy"
	"github.com/google/go-cmp/cmp"
)

func TestMemoryStoreAdd(t *testing.T) {
	const (
		prjPath = "res:prj=gitpod/team=webapp/ws=foobar"
		usrPath = "res:user=chris/ws=foobar"
	)

	store := NewMemoryStore()
	store.Add(policy.ResourceName(prjPath))
	store.Add(policy.ResourceName(usrPath))

	res, err := store.GetNames(policy.ResourceSegment{Type: "ws", ID: "foobar"})
	if err != nil {
		t.Fatal(err)
	}
	if diff := cmp.Diff([]policy.ResourceName{prjPath, usrPath}, res); diff != "" {
		t.Errorf("GetNames() mismatch (-want +got):\n%s", diff)
	}

	res, err = store.GetNames(policy.ResourceSegment{Type: "user", ID: "chris"})
	if err != nil {
		t.Fatal(err)
	}
	if diff := cmp.Diff([]policy.ResourceName{"res:user=chris"}, res); diff != "" {
		t.Errorf("GetNames() mismatch (-want +got):\n%s", diff)
	}

	res, err = store.GetNames(policy.ResourceSegment{Type: "unknown", ID: "resource"})
	if err != nil {
		t.Fatal(err)
	}
	if diff := cmp.Diff([]policy.ResourceName(nil), res); diff != "" {
		t.Errorf("GetNames() mismatch (-want +got):\n%s", diff)
	}
}
