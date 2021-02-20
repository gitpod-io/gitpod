package state

import "testing"

func TestGetObjectKey(t *testing.T) {
	tests := []struct {
		Description      string
		Input            string
		DefaultNamespace string
		ExpectedResult   string
	}{
		{"no namespace", "foo", "default", "default/foo"},
		{"empty default namespace", "foo", "", "default/foo"},
		{"with namespace", "default/foo", "", "default/foo"},
	}

	for _, test := range tests {
		t.Run(test.Description, func(t *testing.T) {
			key := getObjectKey(test.Input, test.DefaultNamespace)
			if key != test.ExpectedResult {
				t.Errorf("%v: expected %v, got %v", test.Description, test.ExpectedResult, key)
			}
		})
	}
}
