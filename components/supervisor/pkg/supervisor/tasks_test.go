// Copyright (c) 2020 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package supervisor

import (
	"context"
	"encoding/json"
	"os"
	"strconv"
	"sync"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/sirupsen/logrus"

	"github.com/gitpod-io/gitpod/common-go/log"
	"github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/terminal"
)

var skipCommand = "echo \"skip\""
var failCommand = "exit 1"

func TestTaskManager(t *testing.T) {
	log.Log.Logger.SetLevel(logrus.FatalLevel)
	tests := []struct {
		Desc        string
		Headless    bool
		Source      api.WorkspaceInitSource
		GitpodTasks *[]TaskConfig

		ExpectedReporter testHeadlessTaskProgressReporter
	}{
		{
			Desc:     "headless prebuild should finish without tasks",
			Headless: true,
			Source:   api.WorkspaceInitFromOther,

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
			},
		},
		{
			Desc:        "headless prebuild should finish without init tasks",
			Headless:    true,
			Source:      api.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Command: &skipCommand}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
			},
		},
		{
			Desc:        "headless prebuild should finish with successful init tasks",
			Headless:    true,
			Source:      api.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &skipCommand}, {Init: &skipCommand}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
			},
		},
		{
			Desc:        "headless prebuild should finish with failed init tasks",
			Headless:    true,
			Source:      api.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &failCommand}, {Init: &failCommand}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: false,
			},
		},
		{
			Desc:        "headless prebuild should finish with at least one failed init tasks (first)",
			Headless:    true,
			Source:      api.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &failCommand}, {Init: &skipCommand}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: false,
			},
		},
		{
			Desc:        "headless prebuild should finish with at least one failed init tasks (second)",
			Headless:    true,
			Source:      api.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &skipCommand}, {Init: &failCommand}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: false,
			},
		},
	}
	for _, test := range tests {
		t.Run(test.Desc, func(t *testing.T) {
			storeLocation, err := os.MkdirTemp("", "tasktest")
			if err != nil {
				t.Fatal(err)
			}
			defer os.RemoveAll(storeLocation)

			gitpodTasks := ""
			if test.GitpodTasks != nil {
				result, err := json.Marshal(test.GitpodTasks)
				if err != nil {
					t.Fatal(err)
				}
				gitpodTasks = string(result)
			}

			var (
				terminalService = terminal.NewMuxTerminalService(terminal.NewMux())
				contentState    = NewInMemoryContentState("")
				reporter        = testHeadlessTaskProgressReporter{}
				taskManager     = newTasksManager(&Config{
					WorkspaceConfig: WorkspaceConfig{
						GitpodTasks:    gitpodTasks,
						GitpodHeadless: strconv.FormatBool(test.Headless),
					},
				}, terminalService, contentState, &reporter)
			)
			taskManager.storeLocation = storeLocation
			contentState.MarkContentReady(test.Source)
			var wg sync.WaitGroup
			wg.Add(1)
			tasksSuccessChan := make(chan bool, 1)
			go taskManager.Run(context.Background(), &wg, tasksSuccessChan)
			wg.Wait()
			if diff := cmp.Diff(test.ExpectedReporter, reporter); diff != "" {
				t.Errorf("unexpected output (-want +got):\n%s", diff)
			}
		})
	}

}

type testHeadlessTaskProgressReporter struct {
	Done    bool
	Success bool
}

func (r *testHeadlessTaskProgressReporter) write(data string, task *task, terminal *terminal.Term) {
}

func (r *testHeadlessTaskProgressReporter) done(success bool) {
	r.Done = true
	r.Success = success
}
