name: Bug Report
description: File a bug report
labels: "bug"
issue_body: true
body:
- type: markdown
  attributes:
    value: Before raising an issue, please search for existing issues to avoid creating duplicates. For questions and support please use the [community forum](https://community.gitpod.io/).
- type: textarea
  attributes:
    label: Bug description
    description: Summarize the bug encountered concisely
  validations:
    required: true
- type: textarea
  attributes:
    label: Steps to reproduce
    description: Describe the steps to reproduce the issue
  validations:
    required: true
- type: textarea
  attributes:
    label: Expected behavior
    description: Describe what you should see instead
- type: textarea
  attributes:
    label: Example repository
    description: If possible, please create an [minimal, reproducible example](https://stackoverflow.com/help/minimal-reproducible-example) of the bug and link it here in the bug report
