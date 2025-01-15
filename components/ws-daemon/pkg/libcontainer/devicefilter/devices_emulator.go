// SPDX-License-Identifier: Apache-2.0
/*
 * Copyright (C) 2020 Aleksa Sarai <cyphar@cyphar.com>
 * Copyright (C) 2020 SUSE LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package devicefilter

import (
	"fmt"
	"sort"

	devices "github.com/gitpod-io/gitpod/ws-daemon/pkg/libcontainer/devices"
)

// deviceMeta is a Rule without the Allow or Permissions fields, and no
// wildcard-type support. It's effectively the "match" portion of a metadata
// rule, for the purposes of our emulation.
type deviceMeta struct {
	node  devices.Type
	major int64
	minor int64
}

// deviceRule is effectively the tuple (deviceMeta, Permissions).
type deviceRule struct {
	meta  deviceMeta
	perms devices.Permissions
}

// deviceRules is a mapping of device metadata rules to the associated
// permissions in the ruleset.
type deviceRules map[deviceMeta]devices.Permissions

func (r deviceRules) orderedEntries() []deviceRule {
	var rules []deviceRule
	for meta, perms := range r {
		rules = append(rules, deviceRule{meta: meta, perms: perms})
	}
	sort.Slice(rules, func(i, j int) bool {
		// Sort by (major, minor, type).
		a, b := rules[i].meta, rules[j].meta
		return a.major < b.major ||
			(a.major == b.major && a.minor < b.minor) ||
			(a.major == b.major && a.minor == b.minor && a.node < b.node)
	})
	return rules
}

type emulator struct {
	defaultAllow bool
	rules        deviceRules
}

func (e *emulator) IsBlacklist() bool {
	return e.defaultAllow
}

func (e *emulator) IsAllowAll() bool {
	return e.IsBlacklist() && len(e.rules) == 0
}

func (e *emulator) addRule(rule deviceRule) error { //nolint:unparam
	if e.rules == nil {
		e.rules = make(map[deviceMeta]devices.Permissions)
	}

	// Merge with any pre-existing permissions.
	oldPerms := e.rules[rule.meta]
	newPerms := rule.perms.Union(oldPerms)
	e.rules[rule.meta] = newPerms
	return nil
}

func (e *emulator) rmRule(rule deviceRule) error {
	// Give an error if any of the permissions requested to be removed are
	// present in a partially-matching wildcard rule, because such rules will
	// be ignored by cgroupv1.
	//
	// This is a diversion from cgroupv1, but is necessary to avoid leading
	// users into a false sense of security. cgroupv1 will silently(!) ignore
	// requests to remove partial exceptions, but we really shouldn't do that.
	//
	// It may seem like we could just "split" wildcard rules which hit this
	// issue, but unfortunately there are 2^32 possible major and minor
	// numbers, which would exhaust kernel memory quickly if we did this. Not
	// to mention it'd be really slow (the kernel side is implemented as a
	// linked-list of exceptions).
	for _, partialMeta := range []deviceMeta{
		{node: rule.meta.node, major: devices.Wildcard, minor: rule.meta.minor},
		{node: rule.meta.node, major: rule.meta.major, minor: devices.Wildcard},
		{node: rule.meta.node, major: devices.Wildcard, minor: devices.Wildcard},
	} {
		// This wildcard rule is equivalent to the requested rule, so skip it.
		if rule.meta == partialMeta {
			continue
		}
		// Only give an error if the set of permissions overlap.
		partialPerms := e.rules[partialMeta]
		if !partialPerms.Intersection(rule.perms).IsEmpty() {
			return fmt.Errorf("requested rule [%v %v] not supported by devices cgroupv1 (cannot punch hole in existing wildcard rule [%v %v])", rule.meta, rule.perms, partialMeta, partialPerms)
		}
	}

	// Subtract all of the permissions listed from the full match rule. If the
	// rule didn't exist, all of this is a no-op.
	newPerms := e.rules[rule.meta].Difference(rule.perms)
	if newPerms.IsEmpty() {
		delete(e.rules, rule.meta)
	} else {
		e.rules[rule.meta] = newPerms
	}
	// TODO: The actual cgroup code doesn't care if an exception didn't exist
	//       during removal, so not erroring out here is /accurate/ but quite
	//       worrying. Maybe we should do additional validation, but again we
	//       have to worry about backwards-compatibility.
	return nil
}

func (e *emulator) allow(rule *deviceRule) error {
	// This cgroup is configured as a black-list. Reset the entire emulator,
	// and put is into black-list mode.
	if rule == nil || rule.meta.node == devices.WildcardDevice {
		*e = emulator{
			defaultAllow: true,
			rules:        nil,
		}
		return nil
	}

	var err error
	if e.defaultAllow {
		err = wrapErr(e.rmRule(*rule), "unable to remove 'deny' exception")
	} else {
		err = wrapErr(e.addRule(*rule), "unable to add 'allow' exception")
	}
	return err
}

func (e *emulator) deny(rule *deviceRule) error {
	// This cgroup is configured as a white-list. Reset the entire emulator,
	// and put is into white-list mode.
	if rule == nil || rule.meta.node == devices.WildcardDevice {
		*e = emulator{
			defaultAllow: false,
			rules:        nil,
		}
		return nil
	}

	var err error
	if e.defaultAllow {
		err = wrapErr(e.addRule(*rule), "unable to add 'deny' exception")
	} else {
		err = wrapErr(e.rmRule(*rule), "unable to remove 'allow' exception")
	}
	return err
}

func (e *emulator) Apply(rule devices.Rule) error {
	if !rule.Type.CanCgroup() {
		return fmt.Errorf("cannot add rule [%#v] with non-cgroup type %q", rule, rule.Type)
	}

	innerRule := &deviceRule{
		meta: deviceMeta{
			node:  rule.Type,
			major: rule.Major,
			minor: rule.Minor,
		},
		perms: rule.Permissions,
	}
	if innerRule.meta.node == devices.WildcardDevice {
		innerRule = nil
	}

	if rule.Allow {
		return e.allow(innerRule)
	}

	return e.deny(innerRule)
}

// Transition calculates what is the minimally-disruptive set of rules need to
// be applied to a devices cgroup in order to transition to the given target.
// This means that any already-existing rules will not be applied, and
// disruptive rules (like denying all device access) will only be applied if
// necessary.
//
// This function is the sole reason for all of Emulator -- to allow us
// to figure out how to update a containers' cgroups without causing spurious
// device errors (if possible).
func (source *emulator) Transition(target *emulator) ([]*devices.Rule, error) { //nolint:revive // Ignore receiver-naming warning.
	var transitionRules []*devices.Rule
	oldRules := source.rules

	// If the default policy doesn't match, we need to include a "disruptive"
	// rule (either allow-all or deny-all) in order to switch the cgroup to the
	// correct default policy.
	//
	// However, due to a limitation in "devices.list" we cannot be sure what
	// deny rules are in place in a black-list cgroup. Thus if the source is a
	// black-list we also have to include a disruptive rule.
	if source.IsBlacklist() || source.defaultAllow != target.defaultAllow {
		transitionRules = append(transitionRules, &devices.Rule{
			Type:        'a',
			Major:       -1,
			Minor:       -1,
			Permissions: devices.Permissions("rwm"),
			Allow:       target.defaultAllow,
		})
		// The old rules are only relevant if we aren't starting out with a
		// disruptive rule.
		oldRules = nil
	}

	// NOTE: We traverse through the rules in a sorted order so we always write
	//       the same set of rules (this is to aid testing).

	// First, we create inverse rules for any old rules not in the new set.
	// This includes partial-inverse rules for specific permissions. This is a
	// no-op if we added a disruptive rule, since oldRules will be empty.
	for _, rule := range oldRules.orderedEntries() {
		meta, oldPerms := rule.meta, rule.perms
		newPerms := target.rules[meta]
		droppedPerms := oldPerms.Difference(newPerms)
		if !droppedPerms.IsEmpty() {
			transitionRules = append(transitionRules, &devices.Rule{
				Type:        meta.node,
				Major:       meta.major,
				Minor:       meta.minor,
				Permissions: droppedPerms,
				Allow:       target.defaultAllow,
			})
		}
	}

	// Add any additional rules which weren't in the old set. We happen to
	// filter out rules which are present in both sets, though this isn't
	// strictly necessary.
	for _, rule := range target.rules.orderedEntries() {
		meta, newPerms := rule.meta, rule.perms
		oldPerms := oldRules[meta]
		gainedPerms := newPerms.Difference(oldPerms)
		if !gainedPerms.IsEmpty() {
			transitionRules = append(transitionRules, &devices.Rule{
				Type:        meta.node,
				Major:       meta.major,
				Minor:       meta.minor,
				Permissions: gainedPerms,
				Allow:       !target.defaultAllow,
			})
		}
	}
	return transitionRules, nil
}

// Rules returns the minimum set of rules necessary to convert a *deny-all*
// cgroup to the emulated filter state (note that this is not the same as a
// default cgroupv1 cgroup -- which is allow-all). This is effectively just a
// wrapper around Transition() with the source emulator being an empty cgroup.
func (e *emulator) Rules() ([]*devices.Rule, error) {
	defaultCgroup := &emulator{defaultAllow: false}
	return defaultCgroup.Transition(e)
}

func wrapErr(err error, text string) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf(text+": %w", err)
}
