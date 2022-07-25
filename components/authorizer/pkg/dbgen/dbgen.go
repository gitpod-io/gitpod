// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dbgen

type TypeSpec struct {
	Name      string
	Table     string
	IDColumn  string
	Relations []Relation
}

type Relation struct {
	Name    string
	Targets []RelationTarget
}

type RelationRef string

func (RelationRef) privateType() {}

type RelationRemoteRef struct {
	Target         *TypeSpec
	Name           string
	RelationColumn string
	ActorRelColumn string
}

func (RelationRemoteRef) privateType() {}

type RelationTarget interface {
	privateType()
}

type RelationSelf struct{}

func (RelationSelf) privateType() {}

type RelationSelfContains struct {
	Column    string
	Substring string
}

func (RelationSelfContains) privateType() {}
