// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package resources

import (
	"encoding/csv"
	"flag"
	"fmt"
	"io"
	"math/rand"
	"os"
	"os/exec"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/gitpod-io/gitpod/common-go/log"
)

var plot = flag.Bool("plot", false, "produces plots of the test cases - useful for debugging. Requires python")

func TestControlCPU(t *testing.T) {
	log.Log.Logger.SetLevel(logrus.PanicLevel)

	bktLimiter := func() BucketLimiter {
		return BucketLimiter{
			Bucket{Budget: 2 * 60 * 500, Limit: 500},
			Bucket{Budget: 4 * 60 * 400, Limit: 400},
			Bucket{Limit: 200},
		}
	}
	clampingBktLimiter := func() *ClampingBucketLimiter {
		return &ClampingBucketLimiter{
			Buckets: []Bucket{
				{Budget: 2 * 60 * 500, Limit: 500},
				{Budget: 4 * 60 * 400, Limit: 400},
				{Budget: 5 * 60 * 180, Limit: 200},
			},
		}
	}

	tests := []struct {
		Name      string
		Opts      []ControllerOpt
		Consumer  consumer
		Validator validator
	}{
		{
			Name:      "bucket regular use",
			Opts:      []ControllerOpt{WithCPULimiter(bktLimiter())},
			Consumer:  splitpointConsumer(fixedConsumer(500), randomConsumer(20, 100), 5*time.Minute),
			Validator: aucValidator(53385),
		},
		{
			Name:      "bucket max abuse",
			Opts:      []ControllerOpt{WithCPULimiter(bktLimiter())},
			Consumer:  fixedConsumer(600),
			Validator: aucValidator(270000),
		},
		{
			Name:      "bucket below radar abuse",
			Opts:      []ControllerOpt{WithCPULimiter(bktLimiter())},
			Consumer:  fixedConsumer(400),
			Validator: aucValidator(216000),
		},
		{
			Name:      "clamped bucket regular use",
			Opts:      []ControllerOpt{WithCPULimiter(clampingBktLimiter())},
			Consumer:  splitpointConsumer(fixedConsumer(500), randomConsumer(20, 100), 5*time.Minute),
			Validator: aucValidator(54600),
		},
		{
			Name:      "clamped bucket max abuse",
			Opts:      []ControllerOpt{WithCPULimiter(clampingBktLimiter())},
			Consumer:  fixedConsumer(600),
			Validator: aucValidator(270000),
		},
		{
			Name:      "clamped bucket below radar abuse",
			Opts:      []ControllerOpt{WithCPULimiter(clampingBktLimiter())},
			Consumer:  fixedConsumer(400),
			Validator: aucValidator(216000),
		},
		{
			Name:      "clamped bucket smart abuser",
			Opts:      []ControllerOpt{WithCPULimiter(clampingBktLimiter())},
			Consumer:  periodicConsumer(splitpointConsumer(fixedConsumer(500), fixedConsumer(100), 5*time.Minute), 10*time.Minute),
			Validator: aucValidator(174000),
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			opts := append(test.Opts, WithControlPeriod(15*time.Minute))
			gov, err := NewController("testcontainer", "instanceid", "none", opts...)
			if err != nil {
				t.Fatalf("cannot create governer: %q", err)
			}

			cfsc := testCFSController{
				Consumer: test.Consumer,
				Period:   100000,
				Quota:    500000,
			}
			gov.cfsController = &cfsc

			dt := gov.SamplingPeriod / 2
			for t := 0 * time.Second; t < 3*gov.ControlPeriod; t += dt {
				gov.controlCPU()

				sample := cfsc.Sample(dt)
				gov.cpuExpenditures.Do(func(s interface{}) {
					si, ok := s.(int64)
					if !ok {
						return
					}
					sample.BudgetSpent += si
				})
			}

			if *plot {
				fn := strings.ReplaceAll(test.Name, " ", "_")
				err := plotSamples(fn, cfsc.Samples)
				if err != nil {
					t.Logf("cannot plot test result: %q", err)
				}
			}

			test.Validator(t, cfsc.Samples)
		})
	}
}

type sample struct {
	T           time.Duration
	Quota       int64
	Usage       int64
	Req         int64
	GrantedReq  int64
	BudgetSpent int64
}

func sampleHeader() []string {
	tpe := reflect.TypeOf(sample{})

	res := make([]string, tpe.NumField())
	for i := 0; i < tpe.NumField(); i++ {
		res[i] = tpe.Field(i).Name
		res[i] = strings.ToLower(res[i][0:1]) + res[i][1:]
	}
	return res
}

func (s sample) toRow() []string {
	tpe := reflect.ValueOf(s)

	res := make([]string, tpe.NumField())
	for i := 0; i < tpe.NumField(); i++ {
		if tpe.Field(i) == tpe.FieldByName("T") {
			res[i] = fmt.Sprintf("%v", float64(tpe.Field(i).Int())/float64(time.Second))
			continue
		}
		res[i] = fmt.Sprintf("%v", tpe.Field(i).Int())
	}
	return res
}

type testCFSController struct {
	Consumer             consumer
	Samples              []*sample
	Quota, Period, Usage int64
	T                    time.Duration
}

func (c *testCFSController) Sample(dt time.Duration) (s *sample) {
	if c.Consumer == nil {
		panic("no consumer")
	}
	req := c.Consumer(c.T)

	usage, _ := c.GetUsage()
	quota, period, _ := c.GetQuota()

	periodToMilliseconds := (time.Duration(period) * time.Microsecond).Milliseconds()
	quotaInMilliseconds := quota / ((10 /* milli-jiffie per jiffie */) * periodToMilliseconds)

	spending := req
	if spending > quotaInMilliseconds {
		spending = quotaInMilliseconds
	}
	s = &sample{
		T:          c.T,
		Quota:      quotaInMilliseconds,
		Usage:      usage,
		Req:        req,
		GrantedReq: spending,
	}
	c.Samples = append(c.Samples, s)

	c.Usage += spending * int64(dt.Milliseconds()) * (1000 * 10)
	c.T += dt
	return
}

func (c *testCFSController) GetUsage() (totalJiffies int64, err error) {
	return c.Usage, nil
}

func (c *testCFSController) GetQuota() (quota, period int64, err error) {
	return c.Quota, c.Period, nil
}

func (c *testCFSController) SetQuota(quota int64) error {
	c.Quota = quota
	return nil
}

func plotSamples(base string, samples []*sample) error {
	script := `
import sys
import pandas as pd
import matplotlib.pyplot as plt

fn = "FILENAME"
df = pd.read_csv(sys.stdin, sep=",")

fig, ax1 = plt.subplots(figsize=(20, 10))
ax1.step(df["t"], df["quota"], linestyle='--', label="quota")
ax1.step(df["t"], df["req"], linestyle=':', label="req")
ax1.step(df["t"], df["grantedReq"], label="limited req")
ax1.set_xlabel('time (s)')
ax1.set_ylabel('diff')
ax2 = ax1.twinx()
ax2.step(df["t"], df["budgetSpent"], label="budget spent")
ax2.set_ylabel("budget (micro jiffies)")
fig.tight_layout()

li1, la1 = ax1.get_legend_handles_labels()
li2, la2 = ax2.get_legend_handles_labels()
ax1.legend(li1+li2, la1+la2, loc=0)
plt.title(fn)
fig.savefig(fname="diff%s.png"%fn)
`
	script = strings.ReplaceAll(script, "FILENAME", base)
	err := os.WriteFile(".plot.py", []byte(script), 0600)
	if err != nil {
		return err
	}
	defer os.Remove(".plot.py")

	ri, ro := io.Pipe()
	cmd := exec.Command("python3", ".plot.py")
	cmd.Stdin = ri
	cmd.Stderr = os.Stderr
	err = cmd.Start()
	if err != nil {
		return err
	}

	cro := csv.NewWriter(ro)
	err = cro.Write(sampleHeader())
	if err != nil {
		return err
	}
	for _, s := range samples {
		err = cro.Write(s.toRow())
		if err != nil {
			return err
		}
	}
	cro.Flush()
	ro.Close()

	err = cmd.Wait()
	if err != nil {
		return err
	}

	return nil
}

type consumer func(t time.Duration) (totalJiffies int64)

type validator func(t *testing.T, samples []*sample)

func fixedConsumer(rate int64) consumer {
	return func(t time.Duration) int64 {
		return rate
	}
}

func randomConsumer(avg, std int64) consumer {
	return func(t time.Duration) int64 {
		s := int64(rand.NormFloat64()*float64(std) + float64(avg))
		if s < 0 {
			s = 0
		}
		return s
	}
}

func splitpointConsumer(before, after consumer, sp time.Duration) consumer {
	return func(t time.Duration) int64 {
		if t < sp {
			return before(t)
		}

		return after(t)
	}
}

func periodicConsumer(delegate consumer, period time.Duration) consumer {
	return func(t time.Duration) int64 {
		return delegate(t % period)
	}
}

// aucValidator limits the area under curve of GrantedReq, i.e. the actual CPU consumed
func aucValidator(limit int64) validator {
	return func(t *testing.T, samples []*sample) {
		var integ int64
		for _, s := range samples {
			integ += s.GrantedReq
		}
		if integ > limit {
			t.Errorf("unexpected high total CPU use %d micro-jiffies, expected %d micro-jiffies", integ, limit)
		}
	}
}
