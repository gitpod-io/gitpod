// +build linux

package signature

import (
	"bytes"
	"debug/elf"
	"io"
	"regexp"
	"strings"

	"golang.org/x/xerrors"
)

// ObjectKind describes a type of object a signature can apply to
type ObjectKind string

const (
	// ObjectAny applies to any object
	ObjectAny ObjectKind = ""
	// ObjectELF applies to ELF binaries
	ObjectELF ObjectKind = "elf"
)

// Domain describes where to look for the file to can for a signature
type Domain string

const (
	// DomainProcess process
	DomainProcess Domain = "process"
	// DomainFileSystem filesystem
	DomainFileSystem Domain = "filesystem"
)

// Signature is an identifying piece of information which can match to file
type Signature struct {
	// Name is a description of the signature
	Name string `json:"name,omitempty"`

	// Domain describe where to look for the file to search for the signature (default: "filesystem")
	Domain Domain `json:"domain,omitempty"`

	// The kind of file this signature can apply to
	Kind ObjectKind `json:"kind,omitempty"`

	// The pattern of the signature
	Pattern []byte `json:"pattern"`

	// If true, the pattern is expected to be a valid regular expression
	Regexp bool `json:"regexp"`

	// Checks only a specific section of the file. If the file is smaller than the end of the slice,
	// the signature does not match.
	Slice Slice `json:"slice,omitempty"`

	// Filenames is a list of filenames this signature can match to
	Filename []string `json:"filenames,omitempty"`

	// compiledRegexp is an optimization so that we don't have to re-compile the regexp every time we use it
	compiledRegexp *regexp.Regexp
}

// Slice demarks the area in a stream in which a signature ought to be tested in
type Slice struct {
	Start int64 `json:"start,omitempty"`
	End   int64 `json:"end,omitempty"`
}

// Validate ensures the signature is valid and thus a file can be matched against it
func (s *Signature) Validate() error {
	if len(s.Pattern) == 0 {
		return xerrors.Errorf("signature has no pattern")
	}
	if s.Regexp {
		c, err := regexp.Compile(string(s.Pattern))
		if err != nil {
			return xerrors.Errorf("signature has invalid regexp pattern: %w", err)
		}
		s.compiledRegexp = c
	}
	if s.Kind == ObjectELF && (s.Slice.Start != 0 || s.Slice.End != 0) {
		return xerrors.Errorf("cannot use slice with ELF object kind")
	}

	if s.Slice.Start < 0 || s.Slice.End < 0 {
		return xerrors.Errorf("slice start and end must be positive")
	}
	if s.Slice.Start != 0 && s.Slice.End != 0 && s.Slice.End <= s.Slice.Start {
		return xerrors.Errorf("slice start must be smaller than slice end")
	}

	if s.Domain == "" {
		s.Domain = DomainFileSystem
	}

	return nil
}

// Matches checks if the signature applies to the stream
func (s *Signature) Matches(in io.ReaderAt) (bool, error) {
	if s.Slice.Start > 0 {
		_, err := in.ReadAt([]byte{}, s.Slice.Start)
		// slice start exceeds what we can read - this signature cannot match
		if err != nil {
			return false, nil
		}
	}
	if s.Slice.End > 0 {
		_, err := in.ReadAt([]byte{}, s.Slice.End)
		// slice start exceeds what we can read - this signature cannot match
		if err != nil {
			return false, nil
		}
	}

	// check the object kind
	if s.Kind != ObjectAny {
		head := make([]byte, 261)
		_, err := in.ReadAt(head, 0)
		if err == io.EOF {
			// cannot read header which means that only Any rules would apply
			return false, nil
		}
		if err != nil {
			return false, xerrors.Errorf("cannot read stream head: %w", err)
		}

		matches := false
		switch s.Kind {
		case ObjectELF:
			matches = isELF(head)
		case ObjectAny:
			matches = true
		}
		if !matches {
			return false, nil
		}
	}

	// match the specific kind
	switch s.Kind {
	case ObjectELF:
		return s.matchELF(in)
	default:
		return s.matchAny(in)
	}
}

// elfMagicNumber are the first few bytes of an ELF file
var elfMagicNumber = []byte{0x7f, 0x45, 0x4c, 0x46}

func isELF(head []byte) bool {
	if len(head) < len(elfMagicNumber) {
		return false
	}

	for i := 0; i < len(elfMagicNumber); i++ {
		if head[i] != elfMagicNumber[i] {
			return false
		}
	}

	return true
}

// matchELF matches a signature against an ELF file
func (s *Signature) matchELF(in io.ReaderAt) (bool, error) {
	symbols, err := ExtractELFSymbols(in)
	if err != nil {
		return false, err
	}

	for _, sym := range symbols {
		matches, err := s.matchesString(sym)
		if matches || err != nil {
			return matches, err
		}
	}
	return false, nil
}

// ExtractELFSymbols extracts all ELF symbol names from an ELF binary
func ExtractELFSymbols(in io.ReaderAt) ([]string, error) {
	executable, err := elf.NewFile(in)
	if err != nil {
		return nil, xerrors.Errorf("cannot anaylse ELF file: %w", err)
	}

	var symbols []string
	syms, err := executable.Symbols()
	if err != nil && err != elf.ErrNoSymbols {
		return nil, xerrors.Errorf("cannot get dynsym section: %w", err)
	}
	for _, s := range syms {
		symbols = append(symbols, s.Name)
	}

	dynsyms, err := executable.DynamicSymbols()
	if err != nil && err != elf.ErrNoSymbols {
		return nil, xerrors.Errorf("cannot get dynsym section: %w", err)
	}
	for _, s := range dynsyms {
		symbols = append(symbols, s.Name)
	}
	return symbols, nil
}

// matchAny matches a signature against a binary file
func (s *Signature) matchAny(in io.ReaderAt) (bool, error) {
	buffer := make([]byte, 8096)
	pos := s.Slice.Start
	for {
		n, err := in.ReadAt(buffer, pos)
		sub := buffer[0:n]
		pos += int64(n)

		// TODO: deal with buffer edges (i.e. pattern wrapping around the buffer edge)
		if bytes.Contains(sub, s.Pattern) {
			return true, nil
		}

		if err == io.EOF {
			break
		}
		if err != nil {
			return false, xerrors.Errorf("cannot read stream: %w", err)
		}
		if s.Slice.End > 0 && pos >= s.Slice.End {
			break
		}
	}

	return false, nil
}

// matchesString checks if the signature matches a string (respects and caches regexp)
func (s *Signature) matchesString(str string) (bool, error) {
	if s.Regexp {
		if s.compiledRegexp == nil {
			var err error
			s.compiledRegexp, err = regexp.Compile(string(s.Pattern))
			if err != nil {
				return false, xerrors.Errorf("invalid regexp pattern: %w", err)
			}
		}

		return s.compiledRegexp.Match([]byte(str)), nil
	}

	return strings.Contains(str, string(s.Pattern)), nil
}
