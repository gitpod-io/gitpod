// Copyright (c) 2021 Gitpod GmbH. All rights reserved.
// Licensed under the GNU Affero General Public License (AGPL).
// See License.AGPL.txt in the project root for license information.
//
// Based on https://github.com/leodido/rn2md with kind permission from the author
package main

import (
	"context"
	"strings"
	"time"

	"github.com/google/go-github/v38/github"
	logger "github.com/sirupsen/logrus"
	"github.com/spf13/cobra"
)

type PullRequestOptions struct {
	Title         string
	Body          string
	Token         string
	ApprovalToken string
	Org           string
	Repo          string
	BaseBranch    string
	HeadBranch    string
}

var prOpts = &PullRequestOptions{}

var pullRequestCommand = &cobra.Command{
	Use:   "pr",
	Long:  "Creates a pull request on the GitHub repo to update the changelog.",
	Short: "Creates a PR to update the changelog.",
	Run: func(c *cobra.Command, args []string) {
		client := NewClient(prOpts.Token)
		// PRs can't be approved by the author of the PR. Thus we need two clients.
		// One for creating the PR and one for approving it.
		approvalClient := NewClient(prOpts.ApprovalToken)
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
		comment0 := "/assign"
		newComment := &github.IssueComment{
			Body: &comment0,
		}
		_, _, err = client.Issues.CreateComment(context, prOpts.Org, prOpts.Repo, *pr.Number, newComment)
		if err != nil {
			logger.WithError(err).Fatal("Error creating comment")
		}
		logger.WithField("url", pr.URL).WithField("pr", pr.Number).Info("PR approval comment added")

		retries := 0

	out:
		for {
			retries++
			if retries > 60 {
				logger.WithError(err).Fatal("Timeout waiting for 'size/S' label to be added by prow")
			}
			labels, _, err := client.Issues.ListLabelsByIssue(context, prOpts.Org, prOpts.Repo, *pr.Number, &github.ListOptions{
				Page:    1,
				PerPage: 20,
			})
			if err != nil {
				logger.WithError(err).Fatal("Error getting labels")
			}
			for _, l := range labels {
				if strings.HasPrefix(*l.Name, "size/") {
					break out
				}
			}
			time.Sleep(time.Second)
		}

		comment1 := "/approve no-issue"
		newComment = &github.IssueComment{
			Body: &comment1,
		}
		_, _, err = client.Issues.CreateComment(context, prOpts.Org, prOpts.Repo, *pr.Number, newComment)
		if err != nil {
			logger.WithError(err).Fatal("Error creating comment")
		}
		logger.WithField("url", pr.URL).WithField("pr", pr.Number).Info("PR approval comment added")

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

		retries = 0
		for {
			retries++
			if retries > 60 {
				logger.WithError(err).Fatal("Timeout trying to approve PR")
			}
			event := "APPROVE"
			_, _, err := approvalClient.PullRequests.CreateReview(context, prOpts.Org, prOpts.Repo, *pr.Number, &github.PullRequestReviewRequest{Event: &event})
			if err != nil {
				logger.WithError(err).Error("Error approving PR. Trying again in a bit.")
				time.Sleep(time.Second)
			} else {
				break
			}
		}
	},
}

func init() {
	// Setup prFlags before the command is initialized
	prFlags := pullRequestCommand.PersistentFlags()
	prFlags.StringVarP(&prOpts.Token, "token", "t", prOpts.Token, "a GitHub personal API token to perform authenticated requests")
	prFlags.StringVarP(&prOpts.ApprovalToken, "approval-token", "a", prOpts.Token, "a GitHub personal API token to perform PR approval")
	prFlags.StringVarP(&prOpts.Org, "org", "o", prOpts.Org, "the github organization")
	prFlags.StringVarP(&prOpts.Repo, "repo", "r", prOpts.Repo, "the github repository name")
	prFlags.StringVarP(&prOpts.HeadBranch, "head", "H", "main", "the head branch for pull requests")
	prFlags.StringVarP(&prOpts.BaseBranch, "base", "b", "main", "the base branch for pull requests")
	prFlags.StringVarP(&prOpts.Title, "title", "T", "[changelog] updated changelog", "the title of the PR")
	prFlags.StringVarP(&prOpts.Body, "body", "B", "Updated the changelog from recent PR descriptions\n\n```release-note\nNONE\n```\n/werft no-test", "the body of the PR")
	rootCommand.AddCommand(pullRequestCommand)
}
