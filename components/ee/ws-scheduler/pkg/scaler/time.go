package scaler

import "time"

// Time encapsulates the timing functions that driver and controller need.
// We introduce this interface to allow for testing.
type timer interface {
	// NewTicker creates a new time.Ticker
	NewTicker(resolution time.Duration) (c <-chan time.Time, stop func())
	// Now() returns the current time
	Now() time.Time
}

// realtime is the actual real-world time
var realtime timer = stdlib{}

type stdlib struct{}

// NewTicker creates a new time.Ticker
func (stdlib) NewTicker(d time.Duration) (c <-chan time.Time, stop func()) {
	t := time.NewTicker(d)
	return t.C, t.Stop
}

// Now() returns the current time
func (stdlib) Now() time.Time {
	return time.Now()
}

type faketime struct {
	Tick            chan time.Time
	ProvideNow      func() time.Time
	NewTickerCalled bool
}

func newFaketime() *faketime {
	return &faketime{
		Tick:       make(chan time.Time),
		ProvideNow: time.Now,
	}
}

// NewTicker creates a new time.Ticker
func (f *faketime) NewTicker(d time.Duration) (c <-chan time.Time, stop func()) {
	f.NewTickerCalled = true
	return f.Tick, func() { close(f.Tick) }
}

// Now() returns the current time
func (f *faketime) Now() time.Time {
	return time.Now()
}
