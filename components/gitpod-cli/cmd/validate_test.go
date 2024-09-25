// Copyright (c) 2024 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package cmd

import (
	"io"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
)

type MockTerminalReader struct {
	Data   [][]byte
	Index  int
	Errors []error
}

func (m *MockTerminalReader) Recv() ([]byte, error) {
	if m.Index >= len(m.Data) {
		return nil, io.EOF
	}
	data := m.Data[m.Index]
	err := m.Errors[m.Index]
	m.Index++
	return data, err
}

func TestProcessTerminalOutput(t *testing.T) {
	tests := []struct {
		name     string
		input    [][]byte
		expected []string
	}{
		{
			name:     "Simple line",
			input:    [][]byte{[]byte("Hello, World!\n")},
			expected: []string{"Hello, World!"},
		},
		{
			name:     "Windows line ending",
			input:    [][]byte{[]byte("Hello\r\nWorld\r\n")},
			expected: []string{"Hello", "World"},
		},
		{
			name: "Updating line",
			input: [][]byte{
				[]byte("Hello, World!\r"),
				[]byte("Hello, World 2!\r"),
				[]byte("Hello, World 3!\n"),
			},
			expected: []string{"Hello, World!", "Hello, World 2!", "Hello, World 3!"},
		},
		{
			name:     "Backspace",
			input:    [][]byte{[]byte("Helloo\bWorld\n")},
			expected: []string{"HelloWorld"},
		},
		{
			name:     "Partial UTF-8",
			input:    [][]byte{[]byte("Hello, 世"), []byte("界\n")},
			expected: []string{"Hello, 世界"},
		},
		{
			name: "Partial emoji",
			input: [][]byte{
				[]byte("Hello "),
				{240, 159},
				{145, 141},
				[]byte("!\n"),
			},
			expected: []string{"Hello 👍!"},
		},
		{
			name:     "Multiple lines in one receive",
			input:    [][]byte{[]byte("Line1\nLine2\nLine3\n")},
			expected: []string{"Line1", "Line2", "Line3"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			reader := &MockTerminalReader{
				Data:   test.input,
				Errors: make([]error, len(test.input)),
			}

			var actual []string
			printLine := func(line string) {
				actual = append(actual, line)
			}

			err := processTerminalOutput(reader, printLine)
			assert.NoError(t, err)

			if diff := cmp.Diff(test.expected, actual); diff != "" {
				t.Errorf("processTerminalOutput() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
