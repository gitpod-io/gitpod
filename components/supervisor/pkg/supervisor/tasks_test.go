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
	csapi "github.com/gitpod-io/gitpod/content-service/api"
	"github.com/gitpod-io/gitpod/supervisor/api"
	"github.com/gitpod-io/gitpod/supervisor/pkg/terminal"
)

var skipCommand = "echo \"skip\""
var failCommand = "exit 1"

var testEnv = &map[string]interface{}{
	"object": map[string]interface{}{"baz": 3},
}
var testEnvCommand = `test $object == "{\"baz\":3}"`

func TestTaskManager(t *testing.T) {
	log.Log.Logger.SetLevel(logrus.FatalLevel)
	tests := []struct {
		Desc        string
		Headless    bool
		Source      csapi.WorkspaceInitSource
		GitpodTasks *[]TaskConfig

		ExpectedReporter testHeadlessTaskProgressReporter
	}{
		{
			Desc:     "headless prebuild should finish without tasks",
			Headless: true,
			Source:   csapi.WorkspaceInitFromOther,

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
			},
		},
		{
			Desc:        "headless prebuild should finish without init tasks",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Command: &skipCommand}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
			},
		},
		{
			Desc:        "headless prebuild should finish with successful init tasks",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &skipCommand}, {Init: &skipCommand}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
			},
		},
		{
			Desc:        "headless prebuild should finish with failed init tasks",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &failCommand}, {Init: &failCommand}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: false,
			},
		},
		{
			Desc:        "headless prebuild should finish with at least one failed init tasks (first)",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &failCommand}, {Init: &skipCommand}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: false,
			},
		},
		{
			Desc:        "headless prebuild should finish with at least one failed init tasks (second)",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &skipCommand}, {Init: &failCommand}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: false,
			},
		},
		{
			Desc:        "env var parsing",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &testEnvCommand, Env: testEnv}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
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
			tasksSuccessChan := make(chan taskSuccess, 1)
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

func (r *testHeadlessTaskProgressReporter) done(success taskSuccess) {
	r.Done = true
	r.Success = !success.Failed()
}

func TestGetTask(t *testing.T) {
	p := func(v string) *string { return &v }
	allTasks := TaskConfig{
		Name:     p("hello world"),
		Before:   p("before"),
		Init:     p("init"),
		Prebuild: p("prebuild"),
		Command:  p("command"),
	}
	tests := []struct {
		Name          string
		Task          TaskConfig
		IsHeadless    bool
		ContentSource csapi.WorkspaceInitSource
		Expectation   string
	}{
		{
			Name:          "prebuild",
			Task:          allTasks,
			IsHeadless:    true,
			ContentSource: csapi.WorkspaceInitFromOther,
			Expectation:   "{\nbefore\n} && {\ninit\n} && {\nprebuild\n}; exit",
		},
		{
			Name:          "from prebuild",
			Task:          allTasks,
			ContentSource: csapi.WorkspaceInitFromPrebuild,
			Expectation:   "{\nbefore\n} && {\n[ -r /workspace/.prebuild-log-0 ] && cat /workspace/.prebuild-log-0; [ -r //prebuild-log-0 ] && cat //prebuild-log-0; true\n} && {\ncommand\n}",
		},
		{
			Name:          "from other",
			Task:          allTasks,
			ContentSource: csapi.WorkspaceInitFromOther,
			Expectation:   "{\nbefore\n} && {\ninit\n} && {\ncommand\n}",
		},
		{
			Name:          "from backup",
			Task:          allTasks,
			ContentSource: csapi.WorkspaceInitFromOther,
			Expectation:   "{\nbefore\n} && {\ninit\n} && {\ncommand\n}",
		},
	}

	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			command := getCommand(&task{config: test.Task, TaskStatus: api.TaskStatus{Id: "0"}}, test.IsHeadless, test.ContentSource, "/")
			if diff := cmp.Diff(test.Expectation, command); diff != "" {
				t.Errorf("unexpected getCommand() (-want +got):\n%s", diff)
			}
		})
	}
}

func TestTaskSuccess(t *testing.T) {
	type Expectation struct {
		Failed bool
		Msg    string
	}

	tests := []struct {
		Name        string
		Input       taskSuccess
		Expectation Expectation
	}{
		{
			Name:        "task success",
			Input:       taskSuccessful,
			Expectation: Expectation{},
		},
		{
			Name:  "task failed",
			Input: taskFailed("failure"),
			Expectation: Expectation{
				Failed: true,
				Msg:    "failure",
			},
		},
		{
			Name:  "task composite failed",
			Input: taskSuccessful.Fail("failed").Fail("some more"),
			Expectation: Expectation{
				Failed: true,
				Msg:    "failed; some more",
			},
		},
	}
	for _, test := range tests {
		t.Run(test.Name, func(t *testing.T) {
			act := Expectation{
				Failed: test.Input.Failed(),
				Msg:    string(test.Input),
			}
			if diff := cmp.Diff(test.Expectation, act); diff != "" {
				t.Errorf("unexpected taskStatus (-want +got):\n%s", diff)
			}
		})
	}
}
