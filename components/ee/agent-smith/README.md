# Agent Smith 🕵️‍♂️

Agent smith is the component that takes care of policing workspaces
against threats and noisy neighbours to make sure that everyone gets a safe and
smooth Gitpod experience.

## How to add new signatures?

```
# find something to match, e.g. using elfdump or by inspecting scripts
agent-smith signature elfdump <binary>

# create a new signature
agent-smith signature new ...
```

Hint: do not use the `base64` to encode a signature

## How can I check if a signature matches?

```
agent-smith signature new <signature-args> | agent-smith signature match <test-binary>
```
