# Configuration

The configuration is the external interface for the Installer. This should adhere to certain rules to ensure maintainability.

## Rules

Requirements

-   [It must maintain backwards compatibility](#it-must-maintain-backwards-compatibility)
-   [Sensitive data must be stored as a secret, not in plain text](#sensitive-data-must-be-stored-as-a-secret-not-in-plain-text)
-   [A new config value must have at least one new golden file test](#a-new-config-value-must-have-at-least-one-new-golden-file-test)
-   [There must be no unexplained changes to existing golden files](#there-must-be-no-unexplained-changes-to-existing-golden-files)
-   [If there are changes to golden files, tell a story with your Git history](#if-there-are-changes-to-golden-files-tell-a-story-with-your-git-history)

Recommendations

-   [New fields should not be added into the experimental section](#new-fields-should-not-be-added-into-the-experimental-section)
-   [New config values should be put at the root of the config](#new-config-values-should-be-put-at-the-root-of-the-config)
-   [New config values should be generic, rather than specific](#new-config-values-should-be-generic-rather-than-specific)
-   [Avoid making new config values team-specific](#avoid-making-new-config-values-team-specific)
-   [Config values should be subject to validatation](#config-values-should-be-subject-to-validatation)

Other considerations

-   [There are different kinds of deployment](#there-are-different-kinds-of-deployment)

### Requirements

Requirements must be adhered to, without exception.

#### It must maintain backwards compatibility

The configuration surface maintains an `apiVersion` which defines the schema used. Backwards compatibility means that a `config.yaml` that is valid must **ALWAYS** be valid.

In practice, this means a few things:

-   A parameter cannot have a `required` tag added to the validation if it has not previously been required. There is some nuance to this requirement - for example, in the registry config, the `external` parameter is only required if `inCluster` is `false`
-   By default, the Installer maintains a strict conversion of the YAML into a Golang struct <sup>[[1](https://pkg.go.dev/sigs.k8s.io/yaml#UnmarshalStrict)]</sup>. Removing any parameter from the definition will cause the configuration to be unparsable

Parameters can be renamed provided that:

1. The old parameter with the current behaviour is retained
2. The old parameter is marked as deprecated in the `CheckDeprecated` function
3. If both the old and new parameters are configured, a conflict error is raised in the `CheckDeprecated` function
4. It is recommended that a rewrite rule is provided from the old to the new parameter

Renaming parameters should be done sparingly as it will lead to much dead code.

The `experimental` section is not covered by this rule. If a parameter is to be removed from here, it should be marked as deprecated for at least 3 months before being removed. This is to allow for any deployments relying upon this parameter to be updated.

---

#### Sensitive data must be stored as a secret, not in plain text

Our configuration is a potential weak point in any deployment. Internally, this is stored as a `ConfigMap` so any sensitive data that is stored in there will be visible to anyone who can read it. The rights to read a `ConfigMap` will typically be provided to more people than those who have the rights to reads a `Secret`.

Consider the `Config` section from the [Twelve-Factor App](https://12factor.net/config):

> A litmus test for whether an app has all config correctly factored out of the code is whether the codebase could be made open source at any moment, without compromising any credentials.

Gitpod is an open-source application, so this is already correct. Instead:

> A customer can submit their `config.yaml` via Discord, email or a GitHub ticket, without compromising any credentials.

By storing sensitive data in the Kubernetes-idiomatic way, it will be easier for Gitpod to maintain and achieve required levels of compliance for ourselves and our users.

Examples of sensitive data:

-   Credentials for external services, such as database, registry, storage
-   Credentials for authorization providers
-   Registry pull secrets
-   SSH credentials
-   Cookie secrets

---

#### A new config value must have at least one new golden file test

We use the golden file pattern as part of the automated testing of the Installer's `render` function. The purpose here is to highlight changes in our rendered Kubernetes YAML file based upon the given source code and to ensure that no unintended changes are introduced. These tests benefit from a high degree of coverage.

To that end, every new config value added must be accompanied with a new golden file test for each option added. For example, if a new config value was an enumerated value with three possible values, then the expectation is that there would be at least three new golden files added. Conversely, if the parameter was a boolean that defaulted to `true`, the pull request will only need to add the `false` value in as the `true` branch will cause all the existing tests to be amended.

---

#### There must be no unexplained changes to existing golden files

The intention behind the `render` golden files is to highlight any changes in the Kubernetes manifests. Typically, each `render` produces a YAML file of around 10,000 lines. This is too much for a human to check, so we use the `git diff` in the pull request to highlight changes.

Changes to a golden file in a pull request are to be anticipated, but there must be no unexplained changes. For example, if you're making a change to the object storage credentials, it would be reasonable to not expect any changes to occur in the database credentials.

Whether a change is unexplained is largely a judgement call, based upon one's experience. However, our peer review process and a discussion with reviewers will provide that experience.

---

#### If there are changes to golden files, tell a story with your Git history

As the golden files can affect vast numbers of lines of code in one commit, it is easier to understand the changes as a story.

For example, if you need to update the Helm dependencies and change a value due to the update, do this as two commits in your PR:

-   The first commit would show the changes made by the updated version
-   The second commit would show the change made by the new value

It is likely that both of these changes would affect many lines in the golden files, so by doing as two commits the reviewer can see what each commit changed. This also makes it easier to see what needs reverting should it be required.

---

### Recommendations

Recommendations should be adhered to, however exceptions may be found to these and be accepted into the codebase. If you do not adhere to the recommendations, you will be expected to justify your decision and be asked about alternative implementations which will comply with the original recommendation.

#### New fields should not be added into the `experimental` section

The `experimental` section existed for a historical purpose, namely to give our engineering team a place to put SaaS-specific configuration without compromising (or giving any implication of support) to these values for Self-Hosted deployments. There was also a requirement to place items in that would not be given the guarantees that we give to the config's main section - these values could be changed or removed without notice.

To a certain extend, this strategy has failed.

In practice, the `experimental` section has been a dumping-ground for new configuration values, added without the rigour that we would expect from enterprise-grade software. This has also become a place where configuration items that don't really fit the definition of "experimental" have been put.

Now, we should prioritise getting these features into the main section of the config. The only exception to that is configuration parameters that meet the original definition of an "experimental" feature - namely, it should be something that is going in to conduct an experiment (eg, an A/B Test) or is something where the long-term definition cannot be known at this early stage, but a feature is required for a limited deployment.

---

#### New config values should be put at the root of the config

New config values should be put as close to the root of the config as makes sense.

By nesting new config values, it may limit the generalised nature of the config in the future and root-level items are easier to search for. This doesn't mean that all values should be put at the root regardless - it may make more sense to group them together in an object and then put that object at the root. For example, if we wanted to specify a port to run a database on, add a `database` object with a `port` key rather than adding `databasePort`.

---

#### New config values should be generic, rather than specific

> For an in-depth discussion on the reasons for replacing Helm, please see [our blog post](https://www.gitpod.io/blog/gitpod-installer) or the talk [Why We Chose To Ditch Helm To Gain Open Source Sanity](https://www.youtube.com/watch?v=W1-cZUXh4zM&ab_channel=CloudNativeRejekts)

The Installer is a replacement for our old Helm charts. One of the fundamental issues with our `values.yaml` file was the length of it and the number of duplicated config items. For instance, the specification of the database password required changes made in a couple of different places. Therefore, the Installer was designed to be able to infer parameters from the config given.

As an example, consider the object storage. You can have four different providers for that object storage - In Cluster, S3 and Google CloudStorage. If In Cluster is enabled, then all of the other three **MUST** not be configured and an error will be returned. Now, let's imagine that you are creating a feature that periodically backs up the database to the object storage - rather than duplicating the storage credentials under the database object, it would be much better reuse the object storage configuration with the database. In this fictional example, you may decide that you don't want to do the backup if it's being stored In Cluster, so you can conditionally exclude that.

---

#### Avoid making new config values team-specific

Our team structures may change at some point in the future.

---

#### Config values should be subject to validatation

The Installer maintains two validation methods.

First is the `config` validation. This exists to check that the config file created is "correct". This check ensures that all required fields are correctly completed, that the data is in a prescribed format and the like.

Second the `cluster` validation. This exists to check that the cluster is configured correctly, based upon the validation given. This check ensures that any secrets configured exist correctly on the cluster, that the nodes have the correct labels etc.

When combined, these provide users with a degree of confidence that a deployment will be successful. It is important that any new config values extend the validation appropriately. For example, if there was a new database configuration added, you would add a `config` check to ensure that the host is in the correct format and that the secret is defined and you would add a `cluster` check to ensure that the secret exists and the relevant keys exist in the secret.

---

### Other considerations

#### There are different `kinds` of deployment

The configuration has a required `kind` parameter, which is used to generate different deployments.

| Kind      | Purpose                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full      | For single-cluster deployments, such as preview or self-hosted                                                                                                           |
| Meta      | This is the `WebApp` and `IDE` components combined. This exists for historical reasons and should be considered deprecated. Used for multi-cluster deployments.          |
| WebApp    | Components deployed to nodes with the `gitpod.io/workload_meta` label.                                                                                                   |
| IDE       | Components deployed to nodes with the `gitpod.io/workload_ide` label.                                                                                                    |
| Workspace | Components deployed to nodes with the `gitpod.io/workload_workspace_headless`, `gitpod.io/workload_workspace_regular` or `gitpod.io/workload_services` labels. |

---
