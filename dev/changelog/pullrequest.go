// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License-AGPL.txt in the project root for license information.
//
// Based on https://github.com/leodido/rn2md with kind permission from the author
package main

import (
	"context"

	"github.com/google/go-github/v38/github"
	logger "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

type PullRequestOptions struct {
	Title      string
	Body       string
	Comment    string
	Token      string
	Org        string
	Repo       string
	BaseBranch string
	HeadBranch string
}

var prOpts = &PullRequestOptions{}

var pullRequestCommand = &cobra.Command{
	Use:   "pr",
	Long:  "Creates a pull request on the GitHub repo to update the changelog.",
	Short: "Creates a PR to update the changelog.",
	Run: func(c *cobra.Command, args []string) {
		client := NewClient(prOpts.Token)
		context := context.Background()
		newPr := &github.NewPullRequest{
			Title: &prOpts.Title,
			Body:  &prOpts.Body,
			Base:  &prOpts.BaseBranch,
			Head:  &prOpts.HeadBranch,
		}
		pr, _, err := client.PullRequests.Create(context, prOpts.Org, prOpts.Repo, newPr)
		if err != nil {
			logger.WithError(err).Fatal("Error creating pull request")
		}
		logger.WithField("url", pr.URL).WithField("pr", pr.Number).Info("PR successfully created")
		if prOpts.Comment != "" {
			newComment := &github.IssueComment{
				Body: &prOpts.Comment,
			}
			_, _, err = client.Issues.CreateComment(context, prOpts.Org, prOpts.Repo, *pr.Number, newComment)
			if err != nil {
				logger.WithError(err).Fatal("Error creating comment")
			}
			logger.WithField("url", pr.URL).WithField("pr", pr.Number).Info("PR approval comment added")
		}
		labels, _, err := client.Issues.AddLabelsToIssue(context, prOpts.Org, prOpts.Repo, *pr.Number, []string{"lgtm", "approved"})
		if err != nil {
			logger.WithError(err).Fatal("Error setting labels")
		}
		l := ""
		for _, label := range labels {
			if l != "" {
				l += ", "
			}
			l += *label.Name
		}
		logger.WithField("labels", l).WithField("pr", pr.Number).Info("PR labels successfully added")
	},
}

func init() {
	// Setup prFlags before the command is initialized
	prFlags := pullRequestCommand.PersistentFlags()
	prFlags.StringVarP(&prOpts.Token, "token", "t", prOpts.Token, "a GitHub personal API token to perform authenticated requests")
	prFlags.StringVarP(&prOpts.Org, "org", "o", prOpts.Org, "the github organization")
	prFlags.StringVarP(&prOpts.Repo, "repo", "r", prOpts.Repo, "the github repository name")
	prFlags.StringVarP(&prOpts.HeadBranch, "head", "H", "main", "the head branch for pull requests")
	prFlags.StringVarP(&prOpts.BaseBranch, "base", "b", "main", "the base branch for pull requests")
	prFlags.StringVarP(&prOpts.Title, "title", "T", "[changelog] updated changelog", "the title of the PR")
	prFlags.StringVarP(&prOpts.Body, "body", "B", "Updated the changelog from recent PR descriptions\n\n```release-note\nNONE\n```\n- [x] /werft no-preview\n- [x] /werft no-test", "the body of the PR")
	prFlags.StringVarP(&prOpts.Comment, "comment", "C", "/approve no-issue", "an additional comment to the PR")
	rootCommand.AddCommand(pullRequestCommand)
}
