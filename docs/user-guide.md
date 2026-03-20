# User Guide

## Navigation

The sidebar includes:

- `Dashboard`: high-level overview (stats/carts)
- `Agents`: manage voice agent definitions
- `Scenarios`: create multi-turn scenarios (turns + expectations)
- `Suites`: group scenarios and run them as a batch
- `Failures`: inbox for failures
- `Test Runs`: browse runs

`Settings` (in the bottom): theme toggle and logout.

## Common workflows

### Create a scenario

1. Open `Scenarios`
2. Create/edit a scenario with one or more turns
3. For each turn, define expectations (message/function/tool/handoff types)

### Create a suite

1. Open `Suites`
2. Click `New Suite` (this opens the suite creation page)
3. Enter `name` + optional `description`
4. Optionally select scenarios to include (`scenario_ids`)
5. Click `Create`

### Run tests

1. Open a scenario and click `Run Test`
2. Open a suite and click `Run All`

### Understand results

Run pages show:

- a run status (pending/running/passed/failed/error)
- turn-by-turn event traces
- judge verdicts / reasoning
- latency + metrics

### Compare runs (diff)

Use the `Compare` option to view side-by-side differences between two runs of the same scenario.

