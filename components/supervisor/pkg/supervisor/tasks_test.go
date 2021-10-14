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

var exampleEnvVarInputs = &map[string]interface{}{
	"JSON_ENV_VAR":     map[string]interface{}{"property": "some string"},
	"JSON_ESCAPED_VAR": "{\"property\":\"some escaped string\"}",
	"JSON_ARRAY_VAR":   []string{"Hello", "World"},
	"STRING_ENV_VAR":   "stringEnvironmentVariable",
	"BOOLEAN_ENV_VAR":  false,
	"NULL_ENV_VAR":     nil,
	"NUMBER_ENV_VAR":   10,
}
var testJSONObjectCommand = `test "$JSON_ENV_VAR" == '{"property":"some string"}'`
var testEscapedJSONObject = `test "$JSON_ESCAPED_VAR" == '{"property":"some escaped string"}'`
var testJSONArrayCommand = `test "$JSON_ARRAY_VAR" == "[\"Hello\",\"World\"]"`
var testStringEnvCommand = `test "$STRING_ENV_VAR" == "stringEnvironmentVariable"`
var testBooleanEnvCommand = `test "$BOOLEAN_ENV_VAR" == false`
var testNullEnvCommand = `test "$NULL_ENV_VAR" == null`
var testNumberEnvCommand = `test "$NUMBER_ENV_VAR" == 10`

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
			Desc:        "JSON object converted to plain text object",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &testJSONObjectCommand, Env: exampleEnvVarInputs}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
			},
		},
		{
			Desc:        "Escaped JSON converts to JSON",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &testEscapedJSONObject, Env: exampleEnvVarInputs}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
			},
		},
		{
			Desc:        "JSON array is treated as plain array",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &testJSONArrayCommand, Env: exampleEnvVarInputs}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
			},
		},
		{
			Desc:        "String environment variable is not treated as JSON (extra quotes are stripped)",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &testStringEnvCommand, Env: exampleEnvVarInputs}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
			},
		},
		{
			Desc:        "Boolean environment variable is treated as a boolean",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &testBooleanEnvCommand, Env: exampleEnvVarInputs}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
			},
		},
		{
			Desc:        "Null environment varibale is treated as null",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &testNullEnvCommand, Env: exampleEnvVarInputs}},

			ExpectedReporter: testHeadlessTaskProgressReporter{
				Done:    true,
				Success: true,
			},
		},
		{
			Desc:        "Number environment variable is treated as number",
			Headless:    true,
			Source:      csapi.WorkspaceInitFromOther,
			GitpodTasks: &[]TaskConfig{{Init: &testNumberEnvCommand, Env: exampleEnvVarInputs}},

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
