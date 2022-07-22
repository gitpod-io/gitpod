// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package dbgen

import (
	"fmt"
	"strings"
	"sync"

	"github.com/dave/jennifer/jen"
)

type Session struct {
	f      *jen.File
	checks [][]string

	once sync.Once
}

func (s *Session) String() string {
	return s.f.GoString()
}

func (s *Session) Commit() {
	s.once.Do(func() {
		s.f.Func().Params(jen.Id("sess").Id("*Session")).Id("Check").Params(jen.Id("ctx").Qual("context", "Context"), jen.Id("actor"), jen.Id("rel"), jen.Id("subject").String()).Params(jen.Bool(), jen.Error()).BlockFunc(func(g *jen.Group) {
			g.List(jen.Id("actorType"), jen.Id("actorKey"), jen.Id("err")).Op(":=").Qual("github.com/gitpod-io/gitpod/authorizer/pkg/executor", "SplitObj").Params(jen.Id("actor"))
			g.If(jen.Id("err").Op("!=").Nil()).Block(jen.Return(jen.Lit(false), jen.Id("err")))
			g.List(jen.Id("_"), jen.Id("subjKey"), jen.Id("err")).Op(":=").Qual("github.com/gitpod-io/gitpod/authorizer/pkg/executor", "SplitObj").Params(jen.Id("subject"))
			g.Switch().BlockFunc(func(g *jen.Group) {
				for _, check := range s.checks {
					spec, rel := check[0], check[1]
					g.Case(jen.Id("actorType").Op("==").Lit(spec).Op("&&").Id("rel").Op("==").Lit(rel)).BlockFunc(func(g *jen.Group) {
						g.Return(jen.Id("sess."+checkFuncName(spec, rel)).Call(jen.Id("ctx"), jen.Id("actorKey"), jen.Id("subjKey")))
					})
				}
			})
			g.Return(jen.Lit(false), jen.Nil())
		})

		s.f.Type().Id("Session").Struct(
			jen.Id("DB").Qual("github.com/gitpod-io/gitpod/authorizer/pkg/executor", "DB"),
		)
	})
}

func NewSession(pkg string) *Session {
	return &Session{f: jen.NewFile(pkg)}
}

func (s *Session) Generate(spec *TypeSpec) error {
	for _, rel := range spec.Relations {
		s.checks = append(s.checks, []string{spec.Name, rel.Name})
		s.f.Func().Params(jen.Id("sess").Id("*Session")).Id(checkFuncName(spec.Name, rel.Name)).Params(jen.Id("ctx").Qual("context", "Context"), jen.Id("actorKey"), jen.Id("subjKey").String()).Params(jen.Bool(), jen.Error()).BlockFunc(func(g *jen.Group) {
			for _, relTarget := range rel.Targets {
				switch rt := relTarget.(type) {
				case RelationRef:
					g.If(jen.List(jen.Id("ok"), jen.Id("err")).Op(":=").Id("sess."+checkFuncName(spec.Name, string(rt))).Call(jen.Id("ctx"), jen.Id("actorKey"), jen.Id("subjKey")), jen.Id("err").Op("!=").Nil()).
						Block(jen.Return(jen.Lit(false), jen.Id("err"))).
						Else().If(jen.Id("ok")).
						Block(jen.Return(jen.Lit(true), jen.Nil()))
				case RelationRemoteRef:
					g.If(jen.List(jen.Id("ok"), jen.Id("err")).Op(":=").Id("sess."+checkFuncName(rt.Target.Name, rt.Name)).Call(jen.Id("ctx"), jen.Id("actorKey"), jen.Id("subjKey")), jen.Id("err").Op("!=").Nil()).
						Block(jen.Return(jen.Lit(false), jen.Id("err"))).
						Else().If(jen.Id("ok")).
						Block(jen.Return(jen.Lit(true), jen.Nil()))
				case RelationTable:
					g.Commentf("is %s from %s", rt.Column, rt.Target.Name)
					g.If(jen.List(jen.Id("ok"), jen.Id("err")).Op(":=").Id("sess.DB.RowExists").Call(jen.Id("ctx"), jen.Lit(spec.Table), jen.Lit(spec.IDColumn), jen.Id("actorKey"), jen.Lit(rt.Column), jen.Id("subjKey")), jen.Id("err").Op("!=").Nil()).
						Block(jen.Return(jen.Lit(false), jen.Id("err"))).
						Else().If(jen.Id("ok")).
						Block(jen.Return(jen.Lit(true), jen.Nil()))
				case RelationSelf:
					g.Commentf("is self")
					g.If(jen.List(jen.Id("ok"), jen.Id("err")).Op(":=").Id("sess.DB.RowExists").Call(jen.Id("ctx"), jen.Lit(spec.Table), jen.Lit(spec.IDColumn), jen.Id("actorKey")), jen.Id("err").Op("!=").Nil()).
						Block(jen.Return(jen.Lit(false), jen.Id("err"))).
						Else().If(jen.Id("ok")).
						Block(jen.Return(jen.Lit(true), jen.Nil()))
				}
			}
			g.Return(jen.Lit(false), jen.Nil())
		})
	}

	return nil
}

func checkFuncName(specName, relName string) string {
	return fmt.Sprintf("check%s%s", camelcase(specName), camelcase(relName))
}

func camelcase(s string) string {
	segs := strings.Split(s, "_")
	for i := range segs {
		segs[i] = strings.Title(segs[i])
	}
	return strings.Join(segs, "")
}
