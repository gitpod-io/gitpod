// Copyright (c) 2023 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.

package estate

import (
	"context"
	"errors"
)

type Database[Resource any] interface {
	Create(ctx context.Context, id string, res *Resource) error
	UpdateResource(ctx context.Context, id string, mod func(res *Resource) (update bool, err error)) error
	List(ctx context.Context, stateToken string) ([]*Resource, error)
	Get(ctx context.Context, id string) (*Resource, error)
	Notifications() <-chan string

	// Snapshot produces a new notification and state token
	Snapshot() error
}

type InMemoryDatabase[Resource any] struct {
	Resources map[string]*Resource
	Notify    chan string
}

func NewInMemoryDatabase[Resource any]() *InMemoryDatabase[Resource] {
	return &InMemoryDatabase[Resource]{
		Resources: make(map[string]*Resource),
		Notify:    make(chan string),
	}
}

var _ Database[any] = &InMemoryDatabase[any]{}

var ErrAlreadyExists = errors.New("already exists")

func (db *InMemoryDatabase[Resource]) Create(ctx context.Context, id string, res *Resource) error {
	if _, ok := db.Resources[id]; ok {
		return ErrAlreadyExists
	}

	db.Resources[id] = res
	return nil
}

func (db *InMemoryDatabase[Resource]) UpdateResource(ctx context.Context, id string, mod func(res *Resource) (update bool, err error)) error {
	res := db.Resources[id]
	update, err := mod(res)
	if err != nil {
		return err
	}
	if update {
		db.Resources[id] = res
	}
	return nil
}

func (db *InMemoryDatabase[Resource]) List(ctx context.Context, stateToken string) ([]*Resource, error) {
	resources := make([]*Resource, 0, len(db.Resources))
	for _, res := range db.Resources {
		resources = append(resources, res)
	}
	return resources, nil
}

func (db *InMemoryDatabase[Resource]) Get(ctx context.Context, id string) (*Resource, error) {
	res, ok := db.Resources[id]
	if !ok {
		return nil, nil
	}
	return res, nil
}

func (db *InMemoryDatabase[Resource]) Notifications() <-chan string {
	return db.Notify
}

func (db *InMemoryDatabase[Resource]) Snapshot() error {
	db.Notify <- "snapshot"
	return nil
}
