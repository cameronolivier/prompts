Upstream rules for judging a PR that adds or changes a Claude Code skill, distilled from Anthropic docs, the Agent Skills spec, and selected community guides. Sources and hashes: `sources.json`. Refresh with `/skill-review --update`.
Last distilled: 2026-10-23

## Contents

- How to apply
- Anthropic (`BP-A`): frontmatter, body content, structure and disclosure, workflows, scripts, invocation and execution fields, evaluation
- Agent Skills spec (`BP-S`): format, authoring guidance
- Extras (`BP-X`)

## How to apply

Cite rule IDs in findings (`BP-A7`, `BP-S3`). Each rule carries a tag and a default severity: `[pregate]` means a script checks it mechanically, `[judge]` means the reviewer decides from reading the skill. Severity is `must` (breaks loading, discovery, or safety), `should` (degrades quality or reliability), or `note` (advisory). Raise or lower severity when context warrants and say why. House conventions (permission scoping, model choice, script thresholds, caches, rate limits, composability, duplication) live in `skill-conventions` and are cited as `skill-conventions §N`, never restated here. When two layers disagree, Anthropic wins over Spec, Spec wins over Extras.

## Anthropic

### Frontmatter

- **BP-A1 Frontmatter parses** [pregate, must] The opening `---` is the file's first line and the YAML between the markers parses. A parse failure loads the body with no fields, so Claude cannot match the description. Source: claude-code-skills#Frontmatter reference
- **BP-A2 Known field names** [pregate, should] Every key matches the Claude Code field table exactly (`name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, `shell`, `metadata`, `license`, `compatibility`). Unknown keys are ignored silently, so `allowed_tools` is a silent bug. Source: claude-code-skills#Frontmatter reference
- **BP-A3 Reserved names** [pregate, must] `name` contains no XML tags and neither `anthropic` nor `claude`; the folder is not `synced` (any case) and does not start with `anthropic-skills`. Source: anthropic-best-practices#Skill structure; claude-code-skills#Choose where skills load
- **BP-A4 Descriptive name** [judge, should] Name says what the skill does: gerund (`processing-pdfs`), noun phrase, or action form, consistent with sibling skills. Flag vague (`helper`, `utils`, `tools`) or generic (`documents`, `data`) names. Source: anthropic-best-practices#Naming conventions
- **BP-A5 Description states what and when** [judge, must] `description` is present and covers both what the skill does and the contexts that should trigger it. Flag "Helps with documents" style descriptions. Source: anthropic-best-practices#Writing effective descriptions
- **BP-A6 Third person** [judge, should] Description reads in third person ("Processes Excel files"), never "I can help" or "You can use this". It is injected into the system prompt. Source: anthropic-best-practices#Writing effective descriptions
- **BP-A7 Listing cap** [pregate, must] `description` plus `when_to_use` totals at most 1,536 characters; text past the cap is cut from the skill listing. Source: claude-code-skills#Frontmatter reference
- **BP-A8 Key use first** [judge, should] The first clause of the description carries the main use case and key terms, since truncation and listing-budget drops remove the tail. Source: claude-code-skills#Skill descriptions are cut short
- **BP-A9 Trigger phrases** [judge, should] Description names concrete trigger contexts and terms a user would say, and leans slightly pushy ("even if they don't mention X") because Claude tends to undertrigger. Source: anthropic-skill-creator#Write the SKILL.md. House detail: see skill-conventions §6.

### Body content

- **BP-A10 Assume Claude is smart** [judge, should] Every paragraph adds context Claude lacks. Cut explanations of well-known concepts, libraries, or formats. Source: anthropic-best-practices#Concise is key
- **BP-A11 Standing instructions** [judge, should] State what to do, worded to hold for the whole task ("run tests after every edit"), since the body stays in context and is not re-read on later turns. Source: claude-code-skills#Types of skill content; claude-code-skills#Skill content lifecycle
- **BP-A12 Explain why over shouting** [judge, should] Give the reason behind an important instruction in place of ALL-CAPS MUST/NEVER or rigid structure. Shouting is a yellow flag. Source: anthropic-skill-creator#Writing Style
- **BP-A13 Degrees of freedom** [judge, should] Specificity matches fragility: prose heuristics where many approaches work, exact commands with "do not modify" where a sequence is fragile. Source: anthropic-best-practices#Set appropriate degrees of freedom
- **BP-A14 Default over menu** [judge, should] Name one default tool or approach with a brief escape hatch, not a list of equal options. Source: anthropic-best-practices#Avoid offering too many options
- **BP-A15 Consistent terminology** [judge, should] One term per concept throughout the skill and its files (not "field", "box", "element" for the same thing). Source: anthropic-best-practices#Use consistent terminology
- **BP-A16 No time-sensitive info** [judge, should] No "before August 2025 use X" conditions. Deprecated approaches go in a collapsed "Old patterns" section. Source: anthropic-best-practices#Avoid time-sensitive information
- **BP-A17 Concrete examples** [judge, should] Where output quality depends on style, give input/output pairs. Templates match strictness to need: exact for data formats, flexible for analysis. Source: anthropic-best-practices#Examples pattern; anthropic-best-practices#Template pattern
- **BP-A18 Lack of surprise** [judge, must] Contents match the skill's stated intent: no malware, exploit code, exfiltration, or hidden behaviour. Source: anthropic-skill-creator#Principle of Lack of Surprise

### Structure and disclosure

- **BP-A19 Body length** [pregate, should] `SKILL.md` body stays under 500 lines; content beyond that moves to separate files. Source: anthropic-best-practices#Token budgets House rule: skill-conventions §9.
- **BP-A20 Signposted references** [judge, should] Each supporting file is linked from `SKILL.md` with what it holds and when to read it ("read `references/api-errors.md` if the API returns non-200"), not a bare "see references/". Source: claude-code-skills#Add supporting files; agentskills-best-practices#Structure large skills with progressive disclosure
- **BP-A21 One level deep** [pregate, should] Reference files link directly from `SKILL.md`. A reference file that sends Claude to another reference file risks partial reads. Source: anthropic-best-practices#Avoid deeply nested references
- **BP-A22 TOC on long references** [pregate, should] Reference files over 100 lines open with a contents list. Source: anthropic-best-practices#Structure longer reference files with a table of contents House rule: skill-conventions §9.
- **BP-A23 Forward slashes** [pregate, must] File paths use `/`, never `\`. Source: anthropic-best-practices#Avoid Windows-style paths
- **BP-A24 Descriptive file names** [judge, note] Files and folders are named for content and grouped by domain (`reference/finance.md`, not `docs/file1.md`). Source: anthropic-best-practices#Runtime environment
- **BP-A25 Survives compaction** [judge, should] The most important instructions sit near the top: after compaction only the first 5,000 tokens of each invoked skill are re-attached, within a 25,000-token shared budget, most recent first. Source: claude-code-skills#Skill content lifecycle House rule: skill-conventions §9.

### Workflows

- **BP-A26 Clear steps** [judge, should] Multi-step tasks are numbered steps; complex ones include a copyable checklist Claude ticks off. Source: anthropic-best-practices#Use workflows for complex tasks
- **BP-A27 Feedback loops** [judge, should] Quality-critical work runs validate, fix, repeat, and proceeds only when validation passes. The validator can be a script or a reference checklist. Source: anthropic-best-practices#Implement feedback loops
- **BP-A28 Plan-validate-execute** [judge, should] Batch, destructive, or high-stakes operations write an intermediate plan file, validate it with a script, then execute. Source: anthropic-best-practices#Create verifiable intermediate outputs
- **BP-A29 Conditional branches** [judge, note] Decision points route explicitly ("Creating new? follow X. Editing? follow Y"); large branches move to their own files. Source: anthropic-best-practices#Conditional workflow pattern
- **BP-A30 Hooks for hard rules** [judge, note] A rule that must hold every time belongs in a hook (`hooks` frontmatter), not prose. Source: claude-code-skills#Claude stops following a skill

### Scripts

- **BP-A31 Solve, don't punt** [judge, must] Scripts handle expected error conditions themselves and print specific, actionable messages (list the valid options), not bare stack traces. Source: anthropic-best-practices#Solve, don't defer
- **BP-A32 No voodoo constants** [judge, should] Every timeout, retry count, or threshold carries a comment justifying its value. Source: anthropic-best-practices#Solve, don't defer
- **BP-A33 Execution intent** [judge, should] Body says whether to run a script ("Run `x.py`") or read it as reference ("See `x.py` for the algorithm"). Source: anthropic-best-practices#Provide utility scripts
- **BP-A34 Script usage documented** [judge, should] Each bundled script the body calls has its command line, arguments, and output format shown in the body or a linked reference. Source: anthropic-best-practices#Provide utility scripts
- **BP-A35 Dependencies documented** [judge, should] Required packages and CLIs are listed with install commands; nothing assumes a tool is installed. Source: anthropic-best-practices#Avoid assuming tools are installed
- **BP-A36 Skill-relative paths** [pregate, should] Bundled scripts and files are referenced as `${CLAUDE_SKILL_DIR}/...` (or `${CLAUDE_PLUGIN_ROOT}` in plugins) in the body, `!` injections, and `allowed-tools` rules, because injected commands run in the session's current directory. Source: claude-code-skills#Available string substitutions; claude-code-skills#How injected commands run
- **BP-A37 Injection failure** [judge, should] Any `!` command that can exit non-zero appends `|| true`, since a failed injection aborts the whole invocation. Injected commands must be pre-approved via `allowed-tools`, or the invocation aborts outside auto mode. Source: claude-code-skills#When an injected command fails; claude-code-skills#Permission checks on injected commands
- **BP-A38 MCP names qualified** [judge, should] MCP tools are named with their server prefix (`ServerName:tool_name`), never the bare tool name. Source: anthropic-best-practices#MCP tool references
- Utility scripts for deterministic, repeated operations: see skill-conventions §2.

### Invocation and execution fields

- **BP-A39 Side effects are user-invoked** [judge, should] Skills with side effects or timing the user controls (deploy, commit, send message) set `disable-model-invocation: true`. This also removes the description from context and blocks subagent preload. Source: claude-code-skills#Control who invokes a skill
- **BP-A40 Background knowledge** [judge, note] Reference content that is not a meaningful command sets `user-invocable: false`. Source: claude-code-skills#Control who invokes a skill
- **BP-A41 allowed-tools semantics** [judge, should] The field pre-approves tools for the invoking turn only and restricts nothing; use `disallowed-tools` to remove tools. Checked-in grants apply without workspace trust, so review them as a security surface. Source: claude-code-skills#Pre-approve tools for a skill
- Scoping `allowed-tools`: see skill-conventions §1.
- **BP-A42 model value** [pregate, should] `model` is a `/model` alias or `inherit`. It applies for the rest of the turn; with `context: fork` it sets the subagent's model. Source: claude-code-skills#Frontmatter reference
- Choosing and requiring `model`: see skill-conventions §7.
- **BP-A43 Fork needs a task** [judge, must] `context: fork` is used only when the body is an explicit, self-contained task. The subagent sees no conversation history, and guidelines without a task return nothing useful. Source: claude-code-skills#Run skills in a subagent
- **BP-A44 Fork settings** [judge, should] Forked skills pick `agent` deliberately (Explore and Plan start without CLAUDE.md) and set `background: false` when the steps need the full tool set or the result in the same turn. Source: claude-code-skills#Run skills in a subagent
- **BP-A45 Arguments** [judge, note] Skills taking input use `$ARGUMENTS`, `$N`, or named `arguments`, set `argument-hint`, and escape literal `$1` as `\$1`. Source: claude-code-skills#Available string substitutions
- **BP-A46 Path scoping** [judge, note] Skills relevant only to certain files set `paths` globs, which are relative to the session's working directory. Source: claude-code-skills#Frontmatter reference
- **BP-A47 Reserved behaviour names** [judge, note] A skill named `verify` or `simplify` is run by Claude before every commit; choose those names only for that purpose. Source: claude-code-skills#Run your checks before each commit

### Evaluation

- **BP-A48 Evals exist** [judge, should] New skills and behaviour changes come with at least three realistic eval prompts, run in fresh sessions with and without the skill. Source: anthropic-best-practices#Build evaluations first; claude-code-skills#Evaluate and iterate on a skill
- **BP-A49 Model coverage** [judge, note] The skill is tested on each model it will run on; Haiku may need more detail than Opus. Source: anthropic-best-practices#Test with all models you plan to use

## Agent Skills spec

### Format

- **BP-S1 Directory layout** [pregate, must] A skill is a directory containing `SKILL.md` (exact case) at its root. Optional subdirectories follow convention: `scripts/` (executable), `references/` (docs), `assets/` (templates, data). Source: agentskills-spec#Directory structure
- **BP-S2 Name present** [pregate, must] `name` is set. Claude Code falls back to the folder name, but the spec and `npx skills` require it. Source: agentskills-spec#Frontmatter
- **BP-S3 Name format** [pregate, must] `name` is 1 to 64 characters and matches `^[a-z0-9]+(-[a-z0-9]+)*$`: lowercase alphanumerics and single hyphens, no leading, trailing, or consecutive hyphens. Source: agentskills-spec#name field
- **BP-S4 Name matches folder** [pregate, must] `name` equals the parent directory name. Source: agentskills-spec#name field
- **BP-S5 Description length** [pregate, must] `description` is 1 to 1,024 characters with no XML tags. This hard cap is stricter than BP-A7. Source: agentskills-spec#description field
- **BP-S6 Compatibility** [pregate, must] `compatibility`, if present, is 1 to 500 characters and appears only for real environment requirements. Source: agentskills-spec#compatibility field
- **BP-S7 Metadata shape** [pregate, should] `metadata` is a map of string keys to string values, with keys unique enough to avoid collisions and not reusing frontmatter field names. Source: agentskills-spec#metadata field; claude-code-skills#Frontmatter reference
- **BP-S8 Portable fields** [judge, note] Only `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` survive claude.ai upload, the Skills API, and `package_skill.py`; any other key is a hard error there. Flag only for skills meant to leave Claude Code. Source: claude-code-skills#Using skill frontmatter outside Claude Code
- **BP-S9 allowed-tools form** [judge, note] The spec form is a space-separated string; Claude Code also accepts a YAML list. Flag only for skills meant for other clients. Source: agentskills-spec#allowed-tools field
- **BP-S10 Token budget** [pregate, should] The `SKILL.md` body stays under about 5,000 tokens (roughly 20,000 characters) as well as 500 lines. Source: agentskills-spec#Progressive disclosure House rule: skill-conventions §9.
- **BP-S11 Relative references** [pregate, should] File references use paths relative to the skill root, and every linked file exists. Source: agentskills-spec#File references
- **BP-S12 Validator passes** [pregate, note] `skills-ref validate <skill-dir>` reports no errors where the tool is available. Source: agentskills-spec#Validation

### Authoring guidance

- **BP-S13 Coherent unit** [judge, should] The skill covers one coherent unit of work: not so narrow that one task loads several skills, not so broad that it triggers imprecisely. Source: agentskills-best-practices#Design coherent units
- **BP-S14 Moderate detail** [judge, note] Stepwise guidance with one working example; edge cases the agent handles well by judgment are left out. Source: agentskills-best-practices#Aim for moderate detail
- **BP-S15 Procedures over declarations** [judge, should] The skill teaches an approach that generalises across a class of tasks, not the answer to one instance. Source: agentskills-best-practices#Favor procedures over declarations
- **BP-S16 Gotchas in SKILL.md** [judge, should] Environment-specific facts that defy reasonable assumptions sit in a gotchas section in `SKILL.md`, where the agent reads them before hitting the case. Source: agentskills-best-practices#Gotchas sections
- **BP-S17 Grounded in real expertise** [judge, note] Content reflects project-specific conventions, failures, and corrections, not generic "follow best practices" filler. Source: agentskills-best-practices#Start from real expertise
- **BP-S18 Description targets user intent** [judge, should] The description frames when to act in terms of what the user is trying to achieve, not internal mechanics, and states boundaries with adjacent skills when false triggers are likely. Source: agentskills-descriptions#Writing effective descriptions
- **BP-S19 Trigger evals** [judge, note] Description changes are backed by about 20 realistic queries (8 to 10 should-trigger, 8 to 10 near-miss should-not-trigger), run 3 times each, with a 60/40 train and validation split. Source: agentskills-descriptions#Designing trigger eval queries; agentskills-descriptions#Avoiding overfitting with train/validation splits
- Bundling scripts the agent keeps reinventing: see skill-conventions §2.

## Extras

- **BP-X1 Description omits workflow** [judge, should] (superpowers) The description states triggers, not a summary of the steps; an agent given a workflow summary follows it instead of reading the skill. Keep the "what" of BP-A5 to one short clause. Source: superpowers-writing-skills#Writing SKILL.md
- **BP-X2 Automate mechanical rules** [judge, should] (superpowers) A constraint checkable by regex or a validator ships as a script or hook, not as skill prose. Source: superpowers-writing-skills#When to Create a Skill
- **BP-X3 Interpreter-prefixed scripts** [pregate, should] (superpowers) The body invokes bundled scripts through their interpreter (`bash scripts/x.sh`, `python3 scripts/x.py`), since some packagers strip executable bits. Source: superpowers-writing-skills#File Organization
- **BP-X4 Baseline before edit** [judge, note] (superpowers) Edits to existing skills, not only new ones, cite an observed failure without the change. Source: superpowers-writing-skills#The Iron Law (Same as TDD)
- **BP-X5 Form matches failure** [judge, should] (superpowers) Guidance form fits the observed failure: prohibition plus rationalization table for discipline lapses, a positive recipe for wrong-shaped output, a required template slot for omissions, a conditional on an observable predicate for situational behaviour. Source: superpowers-writing-skills#Match the Form to the Failure
- **BP-X6 No nuance clauses** [judge, should] (superpowers) Rules carry no "unless it matters" qualifiers or exemption clauses; a real exception is its own conditional on an observable predicate. Source: superpowers-writing-skills#Match the Form to the Failure
- **BP-X7 One strong example** [judge, should] (superpowers) One complete, runnable example in the most relevant language; no multi-language copies and no session narratives ("in session X we found"). Source: superpowers-writing-skills#Code Examples; superpowers-writing-skills#Anti-Patterns
- **BP-X8 Wording micro-tests** [judge, note] (superpowers) Behaviour-shaping wording is checked against a no-guidance control over 5 or more fresh samples before full scenarios. Source: superpowers-writing-skills#Micro-Test Wording Before Full Scenarios
- **BP-X9 Prompt the positive** [judge, should] (mattpocock) Instructions state the target behaviour; a prohibition appears only as a hard guardrail and is paired with the positive target. Source: mattpocock-writing-for-agents#Leading words
- **BP-X10 Delete no-ops** [judge, should] (mattpocock) Each sentence changes behaviour versus the model's default; a sentence that does not is deleted whole. Sharpens BP-A10. Source: mattpocock-writing-for-agents#Pruning
- **BP-X11 Completion criteria** [judge, should] (mattpocock) Every step ends on a checkable, exhaustive done-condition ("every modified model accounted for"), not a vague one ("understanding reached"). Source: mattpocock-writing-for-agents#Steps and completion criteria
- **BP-X12 Single source of truth** [judge, should] (mattpocock) Each meaning lives in one place within the skill; no rule repeated across `SKILL.md` and its references. Cross-skill reuse: see skill-conventions §5. Source: mattpocock-writing-for-agents#Pruning
- **BP-X13 No environment caches** [judge, should] (mattpocock) The skill does not restate what one lookup finds (`package.json` scripts, config values, `--help` output); it records only unwritten conventions, reasons, and gotchas. Source: mattpocock-writing-for-agents#Pruning
- **BP-X14 Co-location** [judge, note] (mattpocock) A concept's definition, rules, and caveats sit under one heading, not scattered. Source: mattpocock-writing-for-agents#Information hierarchy
- **BP-X15 Leading words** [judge, note] (mattpocock) Repeated multi-word descriptions of one idea collapse into a single pretrained concept word used consistently. Source: mattpocock-writing-for-agents#Leading words
- **BP-X16 Pointer branches** [judge, note] (mattpocock) Description triggers list one phrase per distinct case; synonyms renaming the same case are collapsed. Balance against BP-A9. Source: mattpocock-writing-for-agents#Context pointers
- **BP-X17 Invocation choice** [judge, should] (mattpocock) A skill that only ever fires by hand is user-invoked; its description becomes a one-line human summary with trigger lists stripped. Source: mattpocock-skill-mechanics#Invocation
- When to create a new skill versus extend one: see skill-conventions §8.
