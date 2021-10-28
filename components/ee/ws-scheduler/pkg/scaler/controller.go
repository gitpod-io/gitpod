// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the Gitpod Enterprise Source Code License,
// See License.enterprise.txt in the project root folder.

package scaler

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"time"

	"golang.org/x/xerrors"
)

// WorkspaceCount contains the current counts of running workspaces by type.
type WorkspaceCount struct {
	Regular int
	Ghost   int
}

// Controller encapsulates prescaling strategies
type Controller interface {
	// Control starts this controller which is expected to run until the
	// context is canceled. Ths workspaceCount channel provides updates whenever the
	// curent, regular workspace count changes.
	//
	// Writing to the returned ghost count channel will reserve as many workspace
	// slots as was written, i.e. `ghostCount <- 5` will a total of five slots.
	//
	// Beware: controllers MUST read from workspaceCount. If they fail to do so, they'll block the scaler.
	//
	// When the context is canceled and the controller stops, the slotCount channel must be closed.
	Control(ctx context.Context, workspaceCount <-chan WorkspaceCount) (ghostCount <-chan int)
}

// ControllerConfig configures the controller
type ControllerConfig struct {
	Kind ControllerType `json:"kind"`

	Constant struct {
		Setpoint int `json:"setpoint"`
	} `json:"constant"`
	SwitchedConstant struct {
		DefaultSetpoint int                `json:"default"`
		Setpoints       []SwitchedSetpoint `json:"setpoints"`
	} `json:"switchedConstant"`
}

// ControllerType names a kind of controller
type ControllerType string

const (
	// ControllerConstantTarget creates a FixedSlotCount controller
	ControllerConstantTarget ControllerType = "constant"

	// ControllerSwitchedConstantTargets switches setpoints over time
	ControllerSwitchedConstantTargets ControllerType = "switchedConstant"
)

// NewController produces a new controller from configuration
func NewController(c ControllerConfig) (Controller, error) {
	switch c.Kind {
	case ControllerConstantTarget:
		return &ConstantSetpointController{Target: c.Constant.Setpoint}, nil
	case ControllerSwitchedConstantTargets:
		return NewSwitchedSetpointController(c.SwitchedConstant.DefaultSetpoint, c.SwitchedConstant.Setpoints)
	default:
		return nil, xerrors.Errorf("unknown controller kind: %v", c.Kind)
	}
}

// ConstantSetpointController maintains a steadily fixed number of ghost workspaces
type ConstantSetpointController struct {
	Target int
}

// Control starts this controller
func (f *ConstantSetpointController) Control(ctx context.Context, workspaceCount <-chan WorkspaceCount) (ghostCount <-chan int) {
	res := make(chan int)
	go func() {
		defer close(res)
		for {
			select {
			case <-ctx.Done():
				return
			case <-workspaceCount:
				res <- f.Target
			}
		}
	}()
	return res
}

// TimeOfDay is a time during the day. It unmarshals from JSON as hh:mm:ss string.
type TimeOfDay time.Time

// MarshalJSON converts the TimeOfDay into a string
func (t TimeOfDay) MarshalJSON() ([]byte, error) {
	str := time.Time(t).String()
	res, err := time.Parse("2006-01-02 15:04:05 -0700 MST", str)
	if err != nil {
		return nil, err
	}

	return json.Marshal(res.Format("15:04:05"))
}

// UnmarshalJSON unmarshales a time of day
func (t *TimeOfDay) UnmarshalJSON(data []byte) error {
	input := strings.Trim(string(data), "\"")
	res, err := time.Parse("15:04:05", input)
	if err != nil {
		return err
	}
	*t = TimeOfDay(res)
	return nil
}

// SwitchedSetpoint is a setpoint valid from a particular time in the day
type SwitchedSetpoint struct {
	Time     TimeOfDay `json:"time"`
	Setpoint int       `json:"setpoint"`
}

// NewSwitchedSetpointController creates a new SwitchedSetpointController
func NewSwitchedSetpointController(defaultSetpoint int, setpoints []SwitchedSetpoint) (*SwitchedSetpointController, error) {
	if defaultSetpoint < 0 {
		return nil, xerrors.Errorf("defaultSetpoint must be >= 0")
	}

	sort.Slice(setpoints, func(i, j int) bool { return time.Time(setpoints[i].Time).Before(time.Time(setpoints[j].Time)) })
	return &SwitchedSetpointController{
		DefaultSetpoint: defaultSetpoint,
		Setpoints:       setpoints,
		time:            realtime,
	}, nil
}

// SwitchedSetpointController is like the ConstantSetpointController but with different
// setpoints throughout the day.
type SwitchedSetpointController struct {
	DefaultSetpoint int
	Setpoints       []SwitchedSetpoint

	time timer
}

// Control starts this controller
func (c *SwitchedSetpointController) Control(ctx context.Context, workspaceCount <-chan WorkspaceCount) (ghostCount <-chan int) {
	res := make(chan int, 100)

	setpoint := c.DefaultSetpoint
	if csp := c.findSwitchpoint(c.time.Now()); csp != nil {
		setpoint = csp.Setpoint
	}

	tick, stop := c.time.NewTicker(1 * time.Minute)
	go func() {
		defer stop()
		defer close(res)
		for {
			select {
			case <-ctx.Done():
				return
			case t := <-tick:
				var nsp int
				if csp := c.findSwitchpoint(t); csp != nil {
					nsp = csp.Setpoint
				} else {
					nsp = c.DefaultSetpoint
				}
				setpoint = nsp
				res <- setpoint
			case <-workspaceCount:
				res <- setpoint
			}
		}
	}()
	return res
}

func (c *SwitchedSetpointController) findSwitchpoint(t time.Time) *SwitchedSetpoint {
	if len(c.Setpoints) == 0 {
		return nil
	}

	tod := time.Date(0, 1, 1, t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), t.Location())
	for i, sp := range c.Setpoints {
		spt := time.Time(sp.Time)
		if tod.Equal(spt) {
			return &sp
		}

		// c.Setpoints is sorted ascending in NewSwitchedSetpointController
		if tod.After(spt) {
			continue
		}
		if i == 0 {
			return nil
		}

		return &c.Setpoints[i-1]
	}

	return &c.Setpoints[len(c.Setpoints)-1]
}

// SetpointOverTime is a function that determines the number of ghost workspaces over time.
type SetpointOverTime func(t time.Time) (setpoint int)

// NewTimedFunctionController produces a new timed function controller
func NewTimedFunctionController(f SetpointOverTime, resolution time.Duration) *TimedFunctionController {
	return &TimedFunctionController{
		F:          f,
		Resolution: resolution,
		time:       realtime,
	}
}

// TimedFunctionController sample a function over time to set a total amount of ghost workspaces
// that ought to be present at that time.
type TimedFunctionController struct {
	F          func(t time.Time) (setpoint int)
	Resolution time.Duration

	time timer
}

// Control starts this controller
func (c *TimedFunctionController) Control(ctx context.Context, workspaceCount <-chan WorkspaceCount) (ghostDelta <-chan int) {
	res := make(chan int)
	tick, stop := c.time.NewTicker(c.Resolution)
	go func() {
		target := 0
		defer close(res)
		defer stop()
		for {
			select {
			case <-ctx.Done():
				return
			case t := <-tick:
				target = c.F(t)
				res <- target
			case <-workspaceCount:
				res <- target
			}
		}
	}()
	return res
}

// SetpointInTime is a sample produced by RenderTimedFunctionController
type SetpointInTime struct {
	T        time.Time
	Setpoint int
}

// RenderSetpointOverTime renders the behaviour of a SetpointOverTime function
func RenderSetpointOverTime(p SetpointOverTime, start, end time.Time, resolution time.Duration) []SetpointInTime {
	var res []SetpointInTime
	for t := start; t.Before(end); t = t.Add(resolution) {
		res = append(res, SetpointInTime{
			T:        t,
			Setpoint: p(t),
		})
	}
	return res
}
