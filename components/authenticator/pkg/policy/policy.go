package policy

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/go-cmp/cmp"
)

type Policy struct {
	Resources []ResourceName `json:"resources"`
	Actions   []Action       `json:"actions"`
	Effect    Effect         `json:"effect"`
}

func (p Policy) Applies(to ResourceName, with Action) (bool, error) {
	top, err := to.Parse()
	if err != nil {
		return false, err
	}

	var matchesResources bool
	for _, res := range p.Resources {
		resp, err := res.Parse()
		if err != nil {
			return false, err
		}

		if resp.Contains(top) {
			matchesResources = true
			break
		}
	}
	if !matchesResources {
		return false, nil
	}

	var matchesActions bool
	for _, act := range p.Actions {
		if act == with || act == "*" {
			matchesActions = true
			break
		}
	}
	if !matchesActions {
		return false, nil
	}

	return true, nil
}

func (p Policy) WithSubject(subj ResourceName) Policy {
	res := p
	res.Resources = make([]ResourceName, len(p.Resources))
	for i, r := range p.Resources {
		res.Resources[i] = r.ReplaceVariable("subject", subj)
	}
	return res
}

type ResourceName string

var resourceNameRegexp = regexp.MustCompile(`res:(([\w]+)=([\w-]+|\*))(\/(([\w]+)=([\w-]+|\*)))*`)

var ErrInvalidResourceName = errors.New("invalid resource name")

func (n ResourceName) ReplaceVariable(name string, val ResourceName) ResourceName {
	return ResourceName(strings.ReplaceAll(string(n), "$"+name, strings.TrimPrefix(string(val), "res:")))
}

func (n ResourceName) Valid() bool {
	return n == "*" || resourceNameRegexp.MatchString(string(n))
}

func (n ResourceName) IsDefinite() bool {
	return !strings.Contains(string(n), "*")
}

func (n ResourceName) Parse() (ParsedResourceName, error) {
	if !n.Valid() {
		return nil, fmt.Errorf("%w: %s", ErrInvalidResourceName, n)
	}
	if n == "*" {
		return ParsedResourceName{{ID: "*", Type: "*"}}, nil
	}

	segs := strings.Split(string(n[strings.Index(string(n), ":")+1:]), "/")
	var res []ResourceSegment
	for _, seg := range segs {
		kv, err := ParseResourceSegment(seg)
		if err != nil {
			return nil, err
		}
		res = append(res, *kv)
	}

	return res, nil
}

func (n ResourceName) Prepend(seg ResourceSegment) ResourceName {
	return ResourceName("res:" + strings.Join([]string{
		seg.String(),
		strings.TrimPrefix(string(n), "res:"),
	}, "/"))
}

type ParsedResourceName []ResourceSegment

func (n ParsedResourceName) IsAllWildcard() bool {
	return len(n) == 1 && n[0].ID == "*"
}

func (n ParsedResourceName) String() string {
	if n.IsAllWildcard() {
		return "*"
	}

	res := "res:"
	for i, s := range n {
		if i != 0 {
			res += "/"
		}
		res += s.String()
	}
	return res
}

func (n ParsedResourceName) IsDefinite() bool {
	for _, seg := range n {
		if strings.Contains(seg.ID, "*") {
			return false
		}
	}
	return true
}

func (n ParsedResourceName) Contains(other ParsedResourceName) bool {
	if n.IsDefinite() {
		return cmp.Equal(n, other)
	}
	if n.IsAllWildcard() {
		return true
	}

	if len(n) != len(other) {
		return false
	}

	for i := range n {
		nseg, oseg := n[i], other[i]
		if nseg.Type != oseg.Type {
			return false
		}

		if nseg.ID != "*" && nseg.ID != oseg.ID {
			return false
		}
	}
	return true
}

type ResourceSegment struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

func (a *ResourceSegment) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	res, err := ParseResourceSegment(s)
	if err != nil {
		return err
	}
	*a = *res

	return nil
}

func ParseResourceSegment(seg string) (*ResourceSegment, error) {
	kv := strings.Split(seg, "=")
	if len(kv) != 2 {
		return nil, fmt.Errorf("invalid resource segment %s: %w", seg, ErrInvalidResourceName)
	}
	return &ResourceSegment{Type: kv[0], ID: kv[1]}, nil
}

func (rs ResourceSegment) String() string       { return rs.Type + "=" + rs.ID }
func (rs ResourceSegment) ToName() ResourceName { return ResourceName("res:" + rs.String()) }

type Action string

type Effect string

const (
	EffectAllow Effect = "allow"
	EffectDeny  Effect = "deny"
)
