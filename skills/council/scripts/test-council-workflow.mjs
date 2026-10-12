#!/usr/bin/env node
// Runs council-workflow.js against a fake Workflow runtime (no agents, no tokens).
// Usage: node test-council-workflow.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), 'council-workflow.js')
const scriptSource = readFileSync(scriptPath, 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const runScript = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', scriptSource.replace('export const meta', 'const meta'))

const parallel = (thunks) => Promise.all(thunks.map((thunk) => thunk().catch(() => null)))

/** Fake runtime: records every agent call and answers from the supplied responders. */
const convene = async (args, { opinionFor, reviewFor } = {}) => {
  const calls = []
  const logs = []
  const agent = async (prompt, options) => {
    calls.push({ prompt, options })
    if (options.phase === 'Opinions') {
      return opinionFor ? opinionFor(options, prompt) : defaultOpinion(options.label)
    }
    const validLabels = prompt.match(/valid IDs: ([A-H, ]+)\)/)[1].split(', ')
    return reviewFor ? reviewFor(options, validLabels, prompt) : defaultReview(validLabels)
  }
  const result = await runScript(args, agent, parallel, () => {}, (message) => logs.push(message))
  return { result, calls, logs }
}

const defaultOpinion = (persona) => ({
  stance: `${persona} says go`,
  answer: `As ${persona}, I think this works.`,
  key_points: ['one'],
  assumptions: ['demand exists'],
  would_change_mind: 'a failed pilot',
  confidence: 'medium',
})
const defaultReview = (validLabels) => ({
  strongest: { response_id: validLabels[0], why: 'specific' },
  biggest_blind_spot: { response_id: `Response ${validLabels[1]}`, blind_spot: 'cost' },
  core_disagreement: 'timing',
  missed_by_all: 'the competitor',
  ranking: validLabels,
})
const reviewCalls = (calls) => calls.filter((call) => call.options.phase === 'Peer Review')
const SECRET_CONTEXT = 'SECRET-CONTEXT read ./plan.md'

const tests = {
  'script avoids APIs the Workflow runtime forbids': async () => {
    assert.ok(!/Math\.random|Date\.now|new Date\(\)/.test(scriptSource), 'found Math.random / Date.now / new Date()')
  },

  'outsider never receives context and runs as an isolated agent type': async () => {
    const { calls } = await convene({ question: 'Ship it?', context: SECRET_CONTEXT })
    const outsiderCalls = calls.filter((call) => /Outsider/.test(call.options.label))
    assert.equal(outsiderCalls.length, 2)
    for (const call of outsiderCalls) assert.ok(!call.prompt.includes('SECRET-CONTEXT'))
    assert.equal(outsiderCalls[0].options.agentType, 'Explore')
    const informedCalls = calls.filter((call) => /Skeptic/.test(call.options.label))
    for (const call of informedCalls) assert.ok(call.prompt.includes('SECRET-CONTEXT'))
  },

  'outsider falls back to a standard agent and is flagged prompt-only': async () => {
    const { result, logs } = await convene({ question: 'Ship it?' }, {
      opinionFor: (options) => (options.agentType ? null : defaultOpinion(options.label)),
    })
    const outsider = result.council.find((advisor) => advisor.persona === 'The Outsider')
    assert.equal(outsider.isolation, 'prompt-only')
    assert.ok(logs.some((message) => message.includes('isolated agent type unavailable')))
  },

  'review letters are a shuffled permutation and stable for the same question': async () => {
    const first = await convene({ question: 'Workshop or course?' })
    const second = await convene({ question: 'Workshop or course?' })
    const lettersBySeat = (run) => run.result.council.map((advisor) => advisor.review_label)
    assert.deepEqual(lettersBySeat(first), lettersBySeat(second))
    assert.deepEqual([...lettersBySeat(first)].sort(), ['A', 'B', 'C', 'D', 'E'])
    const questions = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6']
    const orderings = new Set()
    for (const question of questions) orderings.add(lettersBySeat(await convene({ question })).join(''))
    assert.ok(orderings.size > 1, 'letters should not follow seat order for every question')
  },

  'review packets hide persona names and start from a different response per reviewer': async () => {
    const { calls } = await convene({ question: 'Ship it?' })
    const firstResponseSeen = new Set()
    for (const call of reviewCalls(calls)) {
      const packet = call.prompt.split('nothing to gain by favouring it.')[1].split('Answer these')[0]
      assert.doesNotMatch(packet, /Skeptic|Expansionist|Outsider|Executor|First Principles/)
      firstResponseSeen.add(packet.match(/### Response ([A-H])/)[1])
    }
    assert.equal(firstResponseSeen.size, 5)
  },

  'self-votes are excluded from the aggregate ranking': async () => {
    const { result } = await convene({ question: 'Ship it?' })
    for (const row of result.aggregate_ranking) assert.equal(row.times_ranked, 4)
    const totalFirstPlaceVotes = result.aggregate_ranking.reduce((sum, row) => sum + row.first_place_votes, 0)
    assert.equal(totalFirstPlaceVotes, 5)
    // everyone submits A>B>C>D>E; A's author's self-vote is dropped, promoting B for that reviewer
    const byLetter = Object.fromEntries(result.council.map((advisor) => [advisor.review_label, advisor.persona]))
    const rowFor = (letter) => result.aggregate_ranking.find((row) => row.persona === byLetter[letter])
    assert.equal(rowFor('A').first_place_votes, 4)
    assert.equal(rowFor('B').first_place_votes, 1)
    assert.equal(rowFor('A').average_rank, 1)
  },

  'invented, repeated, and malformed ranking IDs are cleaned': async () => {
    const { result } = await convene({ question: 'Ship it?' }, {
      reviewFor: (options, validLabels) => ({
        ...defaultReview(validLabels),
        strongest: { response_id: 'Z', why: 'n/a' },
        ranking: ['Response B', 'b', 'Z', 'A', 42, null],
      }),
    })
    for (const review of result.peer_reviews) {
      assert.equal(review.ranking.length, 2)
      assert.equal(review.strongest.persona, null)
    }
  },

  'quick mode skips peer review': async () => {
    const { result, calls } = await convene({ question: 'Ship it?', mode: 'quick' })
    assert.equal(reviewCalls(calls).length, 0)
    assert.deepEqual(result.peer_reviews, [])
    assert.ok(result.aggregate_ranking.every((row) => row.average_rank === null))
  },

  'a failed advisor is named and the council proceeds': async () => {
    const { result, calls } = await convene({ question: 'Ship it?' }, {
      opinionFor: (options) => (/Executor/.test(options.label) ? null : defaultOpinion(options.label)),
    })
    assert.deepEqual(result.advisors_failed, ['The Executor'])
    assert.equal(result.council.length, 4)
    assert.equal(reviewCalls(calls).length, 4)
  },

  'custom members, model overrides, and the seat cap': async () => {
    const customMembers = Array.from({ length: 10 }, (unused, index) => ({
      persona: `Expert ${index}`,
      brief: 'x',
      model: index === 0 ? 'sonnet' : index === 1 ? 'inherit' : undefined,
    }))
    const { result, calls, logs } = await convene({ question: 'Ship it?', mode: 'quick', members: customMembers, model: 'haiku' })
    assert.equal(result.council.length, 8)
    assert.ok(logs.some((message) => message.includes('capped at 8')))
    assert.equal(calls[0].options.model, 'sonnet')
    assert.ok(!('model' in calls[1].options))
    assert.equal(calls[2].options.model, 'haiku')
  },

  'a bare question string is accepted and a missing question is rejected': async () => {
    const { result } = await convene('Ship it?')
    assert.equal(result.question, 'Ship it?')
    assert.equal(result.council[0].model, 'opus')
    await assert.rejects(() => convene({ mode: 'quick' }), /question/)
  },
}

let failureCount = 0
for (const [testName, testBody] of Object.entries(tests)) {
  try {
    await testBody()
    console.log(`ok   ${testName}`)
  } catch (testError) {
    failureCount++
    console.log(`FAIL ${testName}\n     ${testError.message}`)
  }
}
console.log(failureCount === 0 ? `\n${Object.keys(tests).length} passed` : `\n${failureCount} failed`)
process.exit(failureCount === 0 ? 0 : 1)
