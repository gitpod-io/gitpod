package query

import (
	"database/sql"
	"fmt"
	"io"
	"reflect"
	"sort"
	"strings"
	"time"
)

func indent(offset int) string { return strings.Join(make([]string, offset*2), " ") }

type visitorFunc func(depth int, child Condition) error

type Condition interface {
	describe(out io.Writer, indent int) error
	link(m *Model) error
}

type ValueFunc func() string

type conditionExists struct {
	Table string
	Field string
	Value ValueFunc
}

func (c conditionExists) walk(visitor visitorFunc) error {
	return visitor(0, c)
}

func (c conditionExists) describe(out io.Writer, depth int) error {
	_, err := fmt.Fprintf(out, "%s%s.%s == %v\n", indent(depth), c.Table, c.Field, c.Value)
	return err
}

func (c conditionExists) link(*Model) error { return nil }

type combineAnd []Condition

func (c combineAnd) describe(out io.Writer, depth int) error {
	fmt.Fprintf(out, "%sAND\n", indent(depth))
	for _, child := range c {
		err := child.describe(out, depth+1)
		if err != nil {
			return err
		}
	}
	return nil
}

func (c combineAnd) link(m *Model) error {
	for i, child := range c {
		err := child.link(m)
		if err != nil {
			return err
		}
		c[i] = child
	}
	return nil
}

type combineOr []Condition

func (c combineOr) describe(out io.Writer, depth int) error {
	fmt.Fprintf(out, "%sOR\n", indent(depth))
	for _, child := range c {
		err := child.describe(out, depth+1)
		if err != nil {
			return err
		}
	}
	return nil
}

func (c combineOr) link(m *Model) error {
	for i, child := range c {
		err := child.link(m)
		if err != nil {
			return err
		}
		c[i] = child
	}
	return nil
}

// conditionRelationship ensures ActorCond is true, and actorTable.actorKey == subjectTable.subjectKey,
// whereby actorTable must appear in ActorCond. This condition ensures that the actorTable in actorCond,
// and actorTable in the equality condition have the same identity. E.g.
//
// conditionRelationship{
//    ActorCond: conditionExists{Table: "t_foo", Field: "id", Value: actor()},
//    ActorTable: "t_foo",
//    ActorKey: "id",
//    SubjectTable: "t_bar",
//    SubjectKey: "parent",
// }
//
// results in the following query:
//   SELECT COUNT(1) FROM t_foo actor, t_bar r342 WHERE actor.id = "value" AND actor.id = t_bar.parent;
type conditionRelationship struct {
	ActorCond    Condition
	ActorTable   string
	ActorKey     string
	SubjectTable string
	SubjectKey   string
}

func (c conditionRelationship) describe(out io.Writer, depth int) error {
	fmt.Fprintf(out, "%sAND\n", indent(depth))
	c.ActorCond.describe(out, depth+1)
	fmt.Fprintf(out, "%s%s.%s == %s.%s\n", indent(depth+1), c.ActorTable, c.ActorKey, c.SubjectTable, c.SubjectKey)
	return nil
}

func (c conditionRelationship) link(m *Model) error {
	return c.ActorCond.link(m)
}

// OpAnd ands all conditions and ensures table identity, i.e. if multiple conditions refer to the same table,
// OpAnd ensures that the conditions apply to the same instance of that table. E.g.
//   OpAnd(OpExists("t_foo", "id", S("1")), OpExists("t_foo", "field", S("2")))
// results in
//   SELECT COUNT(1) FROM t_foo r1 WHERE r1.id = "1" AND r1.field = "2"
// instead of
//   SELECT COUNT(1) FROM t_foo r1, t_foo r2 WHERE r1.id = "1" AND r2.field = "2"
func OpAnd(conds ...Condition) Condition {
	return combineAnd(conds)
}

func OpOr(conds ...Condition) Condition {
	return combineOr(conds)
}

func OpExists(table, field string, value ValueFunc) Condition {
	return conditionExists{
		Table: table,
		Field: field,
		Value: value,
	}
}

func OpRel(actorCond Condition, actorTable, actorKey, subjectTable, subjectKey string) Condition {
	return conditionRelationship{
		ActorCond:    actorCond,
		ActorTable:   actorTable,
		ActorKey:     actorKey,
		SubjectTable: subjectTable,
		SubjectKey:   subjectKey,
	}
}

type modelRef struct {
	Type string
	Rel  string
	Cond Condition
}

func (c *modelRef) describe(out io.Writer, depth int) error {
	_, err := fmt.Fprintf(out, "%sis %s from %s\n", indent(depth), c.Rel, c.Type)
	return err
}

func (c *modelRef) link(m *Model) error {
	tgt, ok := m.conds[relName(c.Type, c.Rel)]
	if !ok {
		return fmt.Errorf("relationship %s not found", relName(c.Type, c.Rel))
	}
	c.Cond = tgt
	return nil
}

func Ref(tpe, rel string) Condition {
	return &modelRef{Type: tpe, Rel: rel}
}

func NewModel() *Model {
	return &Model{
		conds:       make(map[string]Condition),
		typeToTable: make(map[string]tableInfo),
	}
}

type Model struct {
	conds       map[string]Condition
	typeToTable map[string]tableInfo
}

type tableInfo struct {
	Table  string
	KeyCol string
}

func (m *Model) Type(name, table, keyCol string) AddRel {
	if v, ok := m.typeToTable[name]; ok && (v.Table != table || v.KeyCol != keyCol) {
		panic(fmt.Sprintf("type table mismatch for %s: %s != %s", name, table, v))
	}

	m.typeToTable[name] = tableInfo{
		Table:  table,
		KeyCol: keyCol,
	}
	return AddRel{
		tpe: name,
		m:   m,
	}
}

type AddRel struct {
	tpe string
	m   *Model
}

func (ar AddRel) Rel(name string, c Condition) AddRel {
	ar.m.conds[relName(ar.tpe, name)] = c
	return ar
}

func relName(tpe, rel string) string {
	return fmt.Sprintf("%s:%s", tpe, rel)
}

func (m *Model) ValActor() string {
	return "actor"
}
func (m *Model) ValSubject() string {
	return "subject"
}

func (m *Model) Link() error {
	for _, cond := range m.conds {
		err := cond.link(m)
		if err != nil {
			return err
		}
	}
	return nil
}

func (m Model) Describe(out io.Writer) {
	keys := make([]string, 0, len(m.conds))
	for k := range m.conds {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, key := range keys {
		cond := m.conds[key]

		fmt.Fprintf(out, "%s\n", key)
		cond.describe(out, 1)
		fmt.Fprintln(out)
	}
}

type sqlQuery struct {
	From  map[string]string
	Where string
	Vals  []ValueFunc
}

func (q *sqlQuery) Combine(other sqlQuery, mergeTableNames bool, op string) error {
	if mergeTableNames {
		for shortHand, table := range other.From {
			var foundShorthand bool
			for originalShortHand, orgTable := range q.From {
				if orgTable != table {
					continue
				}

				other.Where = strings.ReplaceAll(other.Where, shortHand, originalShortHand)
				foundShorthand = true
				break
			}

			if !foundShorthand {
				q.From[shortHand] = table
			}
		}
	} else {
		for shortHand, table := range other.From {
			if orgTable, exists := q.From[shortHand]; exists {
				// we have a collision - raise an error
				// TODO(cw): fix the collision rather than raise an error
				return fmt.Errorf("shorthand collision for %s: %s != %s", shortHand, orgTable, table)
			}
			q.From[shortHand] = table
		}
	}

	if q.Where == "" {
		q.Where = other.Where
	} else {
		q.Where = fmt.Sprintf("(%s) %s (%s)", q.Where, op, other.Where)
	}

	q.Vals = append(q.Vals, other.Vals...)

	return nil
}

func (q *sqlQuery) SQL() (string, error) {
	from := make([]string, 0, len(q.From))
	for short, table := range q.From {
		from = append(from, table+" "+short)
	}
	return fmt.Sprintf("SELECT COUNT(1) as Count FROM %s WHERE %s", strings.Join(from, ", "), q.Where), nil
}

func randomShorthand() string {
	return fmt.Sprintf("t%d", time.Now().UnixMicro())
}

func buildQuery(cond Condition) (res *sqlQuery, err error) {
	switch op := cond.(type) {
	case *modelRef:
		if op.Cond == nil {
			return nil, fmt.Errorf("model is not linked (%s.%s has no condition)", op.Type, op.Rel)
		}
		return buildQuery(op.Cond)
	case combineAnd:
		q := sqlQuery{From: make(map[string]string)}
		for _, child := range op {
			res, err := buildQuery(child)
			if err != nil {
				return nil, err
			}
			err = q.Combine(*res, true, "AND")
			if err != nil {
				return nil, err
			}
		}
		return &q, nil
	case combineOr:
		q := sqlQuery{From: make(map[string]string)}
		for _, child := range op {
			res, err := buildQuery(child)
			if err != nil {
				return nil, err
			}
			err = q.Combine(*res, false, "OR")
			if err != nil {
				return nil, err
			}
		}
		return &q, nil
	case conditionExists:
		alias := randomShorthand()
		return &sqlQuery{
			From: map[string]string{
				alias: op.Table,
			},
			Where: fmt.Sprintf("%s.%s = ?", alias, op.Field),
			Vals:  []ValueFunc{op.Value},
		}, nil
	case conditionRelationship:
		q := &sqlQuery{From: make(map[string]string)}

		actorCond, err := buildQuery(op.ActorCond)
		if err != nil {
			return nil, err
		}

		err = q.Combine(*actorCond, true, "AND")
		if err != nil {
			return nil, err
		}

		var actorShorthand, subjectShorthand string
		for short, table := range q.From {
			if table == op.ActorTable {
				actorShorthand = short
				break
			}
		}
		if actorShorthand == "" {
			return nil, fmt.Errorf("actor condition did not refer to actor table %s", op.ActorTable)
		}

		subjectShorthand = randomShorthand()
		q.From[subjectShorthand] = op.SubjectTable

		q.Where = fmt.Sprintf("(%s) AND (%s.%s = %s.%s)", q.Where, actorShorthand, op.ActorKey, subjectShorthand, op.SubjectKey)
		return q, nil
	}
	return nil, fmt.Errorf("buildQuery: unknown condition type: %s", reflect.TypeOf(cond).Name())
}

func (m *Model) prepareQuery(actor, rel, subject string) (q *sqlQuery, err error) {
	cond, ok := m.conds[relName(subject, rel)]
	if !ok {
		return &sqlQuery{
			Where: "TRUE",
		}, nil
	}

	actorTbl, ok := m.typeToTable[actor]
	if !ok {
		return nil, fmt.Errorf("unknown actor table: %s", actor)
	}
	subjTbl, ok := m.typeToTable[subject]
	if !ok {
		return nil, fmt.Errorf("unknown subject table: %s", subject)
	}

	fullCond := OpAnd(
		cond,
		OpExists(actorTbl.Table, actorTbl.KeyCol, m.ValActor),
		OpExists(subjTbl.Table, subjTbl.KeyCol, m.ValSubject),
	)

	return buildQuery(fullCond)

}

func (m *Model) DumpQuery(actor, actorKey, rel, subject, subjectKey string) (sql string, err error) {
	q, err := m.prepareQuery(actor, rel, subject)
	if err != nil {
		return "", err
	}

	res, err := q.SQL()
	if err != nil {
		return "", err
	}
	for _, val := range q.Vals {
		actualVal := val()
		if actualVal == m.ValActor() {
			actualVal = actorKey
		} else if actualVal == m.ValSubject() {
			actualVal = subjectKey
		}

		res = strings.Replace(res, "?", "\""+actualVal+"\"", 1)
	}
	return res, nil
}

func (m *Model) PrepareQuery(db *sql.DB, actor, rel, subject string) (*PreparedStatement, error) {
	q, err := m.prepareQuery(actor, rel, subject)
	if err != nil {
		return nil, err
	}

	res, err := q.SQL()
	if err != nil {
		return nil, err
	}
	prep, err := db.Prepare(res)
	if err != nil {
		return nil, err
	}

	return &PreparedStatement{
		stmt:  prep,
		vals:  q.Vals,
		model: m,
	}, nil
}

type PreparedStatement struct {
	stmt  *sql.Stmt
	vals  []ValueFunc
	model *Model
}

func (ps *PreparedStatement) String() string {
	return fmt.Sprintf("%v", ps.stmt)
}

func (ps *PreparedStatement) Eval(actorKey, subjectKey string) (bool, error) {
	vals := make([]any, 0, len(ps.vals))
	for _, v := range ps.vals {
		actualVal := v()
		if actualVal == ps.model.ValActor() {
			actualVal = actorKey
		} else if actualVal == ps.model.ValSubject() {
			actualVal = subjectKey
		}
		vals = append(vals, actualVal)
	}

	row := ps.stmt.QueryRow(vals...)
	if err := row.Err(); err != nil {
		return false, err
	}

	var res int64
	err := row.Scan(&res)
	if err != nil {
		return false, err
	}

	return res != 0, nil
}
