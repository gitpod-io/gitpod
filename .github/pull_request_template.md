## Description
<!-- Describe your changes in detail -->

## Related Issue(s)
<!-- List the issue(s) this PR solves -->
Fixes #

## How to test
<!-- Provide steps to test this PR -->

## Documentation
<!--
Does this PR require updates to the documentation at www.gitpod.io/docs?
* Yes
  * 1. Please create a docs issue: https://github.com/gitpod-io/website/issues/new?labels=documentation&template=DOCS-NEW-FEATURE.yml&title=%5BDocs+-+New+Feature%5D%3A+%3Cyour+feature+name+here%3E
  * 2. Paste the link to the docs issue below this comment
* No
  * Are you sure? If so, nothing to do here.
-->

#### Preview status

gitpod:summary

## Build Options

<details>
<summary>Build</summary>

- [ ] /werft with-werft
      Run the build with werft instead of GHA
- [ ] leeway-no-cache
- [ ] /werft no-test
      Run Leeway with `--dont-test`
</details>

<details>
<summary>Publish</summary>

- [ ] /werft publish-to-npm
- [ ] /werft publish-to-jb-marketplace
</details>

<details>
<summary>Installer</summary>

- [ ] analytics=segment
- [ ] with-dedicated-emulation
- [ ] workspace-feature-flags
  Add desired feature flags to the end of the line above, space separated
</details>

<details>
<summary>Preview Environment / Integration Tests</summary>

- [ ] /werft with-local-preview
      If enabled this will build `install/preview`
- [ ] /werft with-preview
- [ ] /werft with-large-vm
- [x] /werft with-gce-vm
      If enabled this will create the environment on GCE infra
- [x] /werft preemptible
      Saves cost. Untick this only if you're really sure you need a non-preemtible machine.
- [ ] with-integration-tests=all
      Valid options are `all`, `workspace`, `webapp`, `ide`, `jetbrains`, `vscode`, `ssh`. If enabled, `with-preview` and `with-large-vm` will be enabled.
- [ ] with-monitoring
</details>

/hold
