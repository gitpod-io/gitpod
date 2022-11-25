package policy

import (
	"fmt"
	"sync"
)

type Store interface {
	StoreReader
	StoreWriter
}

type StoreReader interface {
	// Get retrieves all policies for a subject. If the subject is not known, nil is returned.
	Get(subject ResourceName) ([]Policy, error)
}

type StoreWriter interface {
	// Add adds a policy for a subject
	Add(subject ResourceName, policies []Policy) error
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		content: make(map[ResourceName][]Policy),
	}
}

type MemoryStore struct {
	content map[ResourceName][]Policy
	mu      sync.RWMutex
}

var _ Store = ((*MemoryStore)(nil))

func (ms *MemoryStore) Content() map[ResourceName][]Policy {
	return ms.content
}

func (ms *MemoryStore) Get(subject ResourceName) ([]Policy, error) {
	ms.mu.RLock()
	defer ms.mu.RUnlock()

	if !subject.IsDefinite() {
		return nil, fmt.Errorf("subject is not definite")
	}

	subjp, err := subject.Parse()
	if err != nil {
		return nil, err
	}

	var res []Policy
	for k, v := range ms.content {
		kp, err := k.Parse()
		if err != nil {
			return nil, err
		}
		if kp.Contains(subjp) {
			res = append(res, v...)
		}
	}

	return res, nil
}

func (ms *MemoryStore) Add(subject ResourceName, policies []Policy) error {
	ms.mu.Lock()
	defer ms.mu.Unlock()

	ms.content[subject] = append(ms.content[subject], policies...)
	return nil
}
