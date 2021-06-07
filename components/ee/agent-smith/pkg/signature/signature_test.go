package signature

import (
	"bytes"
	"os"
	"testing"

	"github.com/h2non/filetype"
	"github.com/h2non/filetype/matchers"
)

func TestMatchELF(t *testing.T) {
	exec := "/bin/bash"
	input, err := os.OpenFile(exec, os.O_RDONLY, 0600)
	if err != nil {
		t.Errorf("cannot open test executable: %v", err)
		return
	}
	defer input.Close()

	sig := Signature{
		Kind:    ObjectELF,
		Pattern: []byte("bash_groupname_completion_function"),
		Regexp:  false,
	}
	if err := sig.Validate(); err != nil {
		t.Errorf("invalid signature: %v", err)
		return
	}

	matches, err := sig.Matches(input)
	if err != nil {
		t.Errorf("cannot match signature: %v", err)
		return
	}
	if !matches {
		t.Errorf("%s does not match signature", exec)
	}
}

func TestMatchAny(t *testing.T) {
	tests := []struct {
		Input     []byte
		Signature Signature
		Matches   bool
		Err       error
	}{
		{[]byte("hello world!!"), Signature{Kind: ObjectAny, Pattern: []byte("o w")}, true, nil},
		{[]byte("abab dede"), Signature{Kind: ObjectAny, Pattern: []byte("ab"), Slice: Slice{5, 0}}, false, nil},
		{[]byte("abab dede"), Signature{Kind: ObjectAny, Pattern: []byte("de"), Slice: Slice{5, 0}}, true, nil},
	}

	for i, test := range tests {
		if err := test.Signature.Validate(); err != nil {
			t.Errorf("[%03d] invalid signature: %v", i, err)
			return
		}

		matches, err := test.Signature.matchAny(bytes.NewReader(test.Input))
		if err != nil {
			t.Errorf("[%03d] cannot match signature: %v", i, err)
			return
		}
		if matches != test.Matches {
			t.Errorf("[%03d] expected match == %v, actual is %v", i, test.Matches, matches)
		}
	}
}

func TestIsELF(t *testing.T) {
	tests := []struct {
		Name  string
		Input []byte
	}{
		{"ELF", []byte{0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}},
		{"JPEG2000", []byte{0x00, 0x00, 0x00, 0x0C, 0x6A, 0x50, 0x20, 0x20, 0x0D, 0x0A}},
		{"too short", []byte{}},
	}

	for _, test := range tests {
		// test our input against a known library to make sure we actually have an ELF binary on our hands
		isActuallyELF := filetype.IsType(test.Input, matchers.TypeElf)
		weThinkItsELF := isELF(test.Input)

		if weThinkItsELF != isActuallyELF {
			t.Errorf("%s: input does not test as same ELF-ness as gold standard. %v expected, %v actual", test.Name, isActuallyELF, weThinkItsELF)
		}
	}
}
