package resourcegraph

import (
	"fmt"
	"io"
	"sync"

	"github.com/gitpod-io/gitpod/authenticator/pkg/policy"
)

type Store interface {
	StoreReader
	StoreWriter
}

type StoreReader interface {
	GetNames(res policy.ResourceSegment) ([]policy.ResourceName, error)
}

type StoreWriter interface {
	Add(resource policy.ResourceName) error

	Dump(io.Writer)
}

type MemoryStore struct {
	resIndex map[string][]*policy.ResourceSegment
	mu       sync.RWMutex
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		resIndex: make(map[string][]*policy.ResourceSegment),
	}
}

func (ms *MemoryStore) Dump(out io.Writer) {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	for n, parents := range ms.resIndex {
		for _, parent := range parents {
			fmt.Fprintf(out, "%s child of %v\n", n, parent)
		}
	}
}

func (ms *MemoryStore) ToGraphviz(out io.Writer) {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	fmt.Fprintln(out, "digraph {")

	nodeIdx := make(map[string]string)
	var n int
	nodeID := func(name string) string {
		r, ok := nodeIdx[name]
		if !ok {
			r = fmt.Sprintf("node%03d", n)
			n++
			nodeIdx[name] = r
		}
		return r
	}

	for child, parents := range ms.resIndex {
		for _, parent := range parents {
			childID := nodeID(child)
			if parent != nil {
				fmt.Fprintf(out, "%s -> %s;\n", nodeID(parent.String()), childID)
			}
		}
	}

	for label, id := range nodeIdx {
		fmt.Fprintf(out, "%s [label=\"%s\"];\n", id, label)
	}

	fmt.Fprintln(out, "}")
}

func (ms *MemoryStore) GetNames(res policy.ResourceSegment) ([]policy.ResourceName, error) {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	if _, ok := ms.resIndex[res.String()]; !ok {
		return nil, nil
	}

	return ms.getNames(res, res.ToName())
}

func (ms *MemoryStore) getNames(res policy.ResourceSegment, path policy.ResourceName) ([]policy.ResourceName, error) {
	parents := ms.resIndex[res.String()]
	if len(parents) == 0 {
		return []policy.ResourceName{path}, nil
	}

	var result []policy.ResourceName
	for _, parent := range parents {
		if parent == nil {
			// end of line
			result = append(result, path)
			continue
		}

		pe, err := ms.getNames(*parent, path.Prepend(*parent))
		if err != nil {
			return nil, err
		}
		result = append(result, pe...)
	}
	return result, nil
}

func (ms *MemoryStore) Add(resource policy.ResourceName) error {
	segs, err := resource.Parse()
	if err != nil {
		return err
	}

	ms.mu.Lock()
	defer ms.mu.Unlock()

	if len(segs) == 0 {
		return nil
	}
	if len(segs) == 1 {
		p := segs[0].String()
		ms.resIndex[p] = append(ms.resIndex[p], nil)
		return nil
	}

	for i := len(segs) - 2; i >= 0; i-- {
		key := segs[i+1].String()
		s := segs[i]

		ms.resIndex[key] = append(ms.resIndex[key], &s)
	}
	ms.resIndex[segs[0].String()] = append(ms.resIndex[segs[0].String()], nil)

	return nil
}
