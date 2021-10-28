// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scaler

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
)

func TestConstantSetpointController(t *testing.T) {
	type Step struct {
		Input    int
		Expected int
	}
	tests := []struct {
		Name   string
		Target int
		Steps  []Step
	}{
		{
			Name:   "0 target",
			Target: 0,
			Steps: []Step{
				{0, 0},
				{10, 0},
			},
		},
		{
			Name:   "10 target",
			Target: 10,
			Steps: []Step{
				{0, 10},
				{10, 10},
				{5, 10},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			c := &ConstantSetpointController{Target: test.Target}
			inc := make(chan WorkspaceCount)

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			out := c.Control(ctx, inc)
			for i, s := range test.Steps {
				t.Run(fmt.Sprintf("step_%03d", i), func(t *testing.T) {
					inc <- WorkspaceCount{Ghost: s.Input}
					act := <-out

					if diff := cmp.Diff(s.Expected, act); diff != "" {
						t.Errorf("unexpected result (-want +got):\n%s", diff)
					}
				})
			}
		})
	}
}

func TestTimedFunctionController(t *testing.T) {
	type Step struct {
		Time   time.Time
		Target int
	}
	tests := []struct {
		Name  string
		F     SetpointOverTime
		Steps []Step
	}{
		{
			Name: "linear",
			F: func(t time.Time) (setpoint int) {
				return int(t.Sub(time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)).Seconds())
			},
			Steps: []Step{
				{Time: time.Date(2020, 1, 1, 5, 0, 0, 0, time.UTC), Target: 18000},
				{Time: time.Date(2020, 1, 1, 6, 0, 0, 0, time.UTC), Target: 21600},
				{Time: time.Date(2020, 1, 1, 7, 0, 0, 0, time.UTC), Target: 25200},
				{Time: time.Date(2020, 1, 1, 8, 0, 0, 0, time.UTC), Target: 28800},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			faketime := newFaketime()
			c := &TimedFunctionController{
				F:    test.F,
				time: faketime,
			}
			inc := make(chan WorkspaceCount)

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			tchan := c.Control(ctx, inc)

			if !faketime.NewTickerCalled {
				t.Fatal("NewTicker was not called")
			}

			for i, s := range test.Steps {
				t.Run(fmt.Sprintf("step_%03d", i), func(t *testing.T) {
					faketime.Tick <- s.Time
					act := <-tchan

					if diff := cmp.Diff(s.Target, act); diff != "" {
						t.Errorf("unexpected result (-want +got):\n%s", diff)
					}
				})
			}
		})
	}
}

func TestSwitchedSetpointController(t *testing.T) {
	p := func(tod string) TimeOfDay {
		res, err := time.Parse("15:04:05", tod)
		if err != nil {
			t.Fatal(err)
		}
		return TimeOfDay(res)
	}

	type Step struct {
		Time   TimeOfDay
		Target int
	}
	tests := []struct {
		Name            string
		DefaultSetpoint int
		Setpoints       []SwitchedSetpoint
		Steps           []Step
	}{
		{
			Name:            "basic switchover",
			DefaultSetpoint: 2,
			Setpoints: []SwitchedSetpoint{
				{Time: p("08:00:00"), Setpoint: 10},
				{Time: p("12:00:00"), Setpoint: 5},
				{Time: p("18:00:00"), Setpoint: 1},
			},
			Steps: []Step{
				{Time: p("05:00:00"), Target: 2},
				{Time: p("09:00:00"), Target: 10},
				{Time: p("10:00:00"), Target: 10},
				{Time: p("12:00:00"), Target: 5},
				{Time: p("13:00:00"), Target: 5},
				{Time: p("19:00:00"), Target: 1},
			},
		},
		{
			Name:            "next day",
			DefaultSetpoint: 2,
			Setpoints: []SwitchedSetpoint{
				{Time: p("08:00:00"), Setpoint: 10},
			},
			Steps: []Step{
				{Time: p("05:00:00"), Target: 2},
				{Time: p("09:00:00"), Target: 10},
				{Time: p("05:00:00"), Target: 2},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			c, err := NewSwitchedSetpointController(test.DefaultSetpoint, test.Setpoints)
			if err != nil {
				t.Fatal(err)
			}

			faketime := newFaketime()
			c.time = faketime
			faketime.ProvideNow = func() time.Time { return time.Time(p("00:00:00")) }

			inc := make(chan WorkspaceCount)

			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			schan := c.Control(ctx, inc)

			if !faketime.NewTickerCalled {
				t.Fatal("NewTicker was not called")
			}

			for i, s := range test.Steps {
				t.Run(fmt.Sprintf("step_%03d_%s", i, time.Time(s.Time).String()), func(t *testing.T) {
					faketime.Tick <- time.Time(s.Time)
					act := <-schan

					if diff := cmp.Diff(s.Target, act); diff != "" {
						t.Errorf("unexpected result (-want +got):\n%s", diff)
					}
				})
			}
		})
	}
}

func TestTimeOfDayMarshalJSON(t *testing.T) {
	tests := []struct {
		Input       time.Time
		Expectation string
		Error       string
	}{
		{time.Date(0, 1, 1, 0, 0, 0, 0, time.UTC), "00:00:00", ""},
		{time.Date(0, 1, 1, 23, 59, 59, 0, time.UTC), "23:59:59", ""},
		{time.Date(0, 1, 1, 12, 0, 0, 0, time.UTC), "12:00:00", ""},
	}

	for _, test := range tests {
		t.Run(test.Expectation, func(t *testing.T) {
			input := TimeOfDay(test.Input)
			b, err := json.Marshal(input)

			var errmsg string
			if err != nil {
				errmsg = err.Error()
			}
			if errmsg != test.Error {
				t.Fatalf("unepxected error: want %v, got %v", test.Error, errmsg)
				return
			}
			if err != nil {
				return
			}

			e, err := json.Marshal(test.Expectation)
			if err != nil {
				t.Fatal(err.Error())
				return
			}

			marshalled := string(b)
			expectation := string(e)

			if marshalled != expectation {
				t.Fatalf("unexpected result: want %v, got %v", expectation, marshalled)
				return
			}
		})
	}
}

func TestTimeOfDayUnmarshalJSON(t *testing.T) {
	tests := []struct {
		Input       string
		Expectation time.Time
		Error       string
	}{
		{"00:00:00", time.Date(0, 1, 1, 0, 0, 0, 0, time.UTC), ""},
		{"23:59:59", time.Date(0, 1, 1, 23, 59, 59, 0, time.UTC), ""},
		{"12:00:00", time.Date(0, 1, 1, 12, 0, 0, 0, time.UTC), ""},
		{"24:00:00", time.Date(0, 1, 1, 0, 0, 0, 0, time.UTC), "parsing time \"24:00:00\": hour out of range"},
	}

	for _, test := range tests {
		t.Run(test.Input, func(t *testing.T) {
			var act TimeOfDay
			err := json.Unmarshal([]byte(fmt.Sprintf("\"%s\"", test.Input)), &act)

			var errmsg string
			if err != nil {
				errmsg = err.Error()
			}
			if errmsg != test.Error {
				t.Fatalf("unepxected error: want %v, got %v", test.Error, errmsg)
				return
			}
			if err != nil {
				return
			}

			if time.Time(act) != test.Expectation {
				t.Fatalf("unepxected result: want %v, got %v", test.Expectation.String(), time.Time(act).String())
				return
			}
		})
	}
}
