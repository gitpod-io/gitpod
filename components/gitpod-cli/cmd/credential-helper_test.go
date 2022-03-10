// Copyright (c) 2022 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.

package cmd

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func Test_parse_git_command_and_remote(t *testing.T) {
	tests := []struct {
		Name     string
		Commands []string
		Expected gitCommandInfo
	}{
		{
			Name: "Detect push command",
			Commands: []string{
				"/usr/lib/git-core/git-remote-https origin https://github.com/jeanp413/test-gp-bug.git",
				"/usr/lib/git-core/git push",
			},
			Expected: gitCommandInfo{RepoUrl: "https://github.com/jeanp413/test-gp-bug.git", GitCommand: "push"},
		},
		{
			Name: "Detect with remote named origin",
			Commands: []string{
				"/usr/lib/git-core/git-remote-https origin https://github.com/jeanp413/test-gp-bug.git",
				"/usr/lib/git-core/git remote-https origin https://github.com/jeanp413/test-gp-bug.git",
				"git push origin master",
			},
			Expected: gitCommandInfo{RepoUrl: "https://github.com/jeanp413/test-gp-bug.git", GitCommand: "push"},
		},
		{
			Name: "Detect with remote named foo",
			Commands: []string{
				"/usr/lib/git-core/git-remote-https foo https://github.com/jeanp413/test-private-package.git",
				"/usr/lib/git-core/git remote-https foo https://github.com/jeanp413/test-private-package.git",
				"git push foo master",
			},
			Expected: gitCommandInfo{RepoUrl: "https://github.com/jeanp413/test-private-package.git", GitCommand: "push"},
		},
		{
			Name: "Detect ls-remote command",
			Commands: []string{
				"/usr/lib/git-core/git-remote-https https://github.com/joepurdy/private-npm-package.git https://github.com/joepurdy/private-npm-package.git",
				"/usr/lib/git-core/git remote-https https://github.com/joepurdy/private-npm-package.git https://github.com/joepurdy/private-npm-package.git",
				"git --no-replace-objects ls-remote https://github.com/joepurdy/private-npm-package.git",
			},
			Expected: gitCommandInfo{RepoUrl: "https://github.com/joepurdy/private-npm-package.git", GitCommand: "ls-remote"},
		},
		{
			Name: "Detect clone command",
			Commands: []string{
				"/usr/lib/git-core/git-remote-https origin https://github.com/jeanp413/test-private-package.git",
				"/usr/lib/git-core/git remote-https origin https://github.com/jeanp413/test-private-package.git",
				"git --no-replace-objects clone https://github.com/jeanp413/test-private-package.git /home/gitpod/.npm/_cacache/tmp/git-cloneUsL7Mf --recurse-submodules --depth=1",
			},
			Expected: gitCommandInfo{RepoUrl: "https://github.com/jeanp413/test-private-package.git", GitCommand: "clone"},
		},
		{
			Name: "JB push command",
			Commands: []string{
				"/usr/lib/git-core/git remote-https origin https://github.com/gitpod-io/spring-petclinic.git",
				"/bin/git -c core.quotepath=false -c log.showSignature=false push --progress --porcelain origin refs/heads/master:master",
			},
			Expected: gitCommandInfo{RepoUrl: "https://github.com/gitpod-io/spring-petclinic.git", GitCommand: "push"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.Name, func(t *testing.T) {
			gitCmdInfo := gitCommandInfo{}
			for _, command := range tt.Commands {
				gitCmdInfo.parseGitCommandAndRemote(command)
			}

			equal := cmp.Equal(gitCmdInfo, tt.Expected)
			if !equal {
				t.Fatalf(`Detected git command info was incorrect, got: %v, expected: %v.`, gitCmdInfo, tt.Expected)
			}
		})
	}
}
