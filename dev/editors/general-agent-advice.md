How we structure our CLAUDE.md file (and why)

A good [CLAUDE.md](http://claude.md/) (or [AGENT.md](https://agent.md/), [AGENTS.md](http://agents.md/), .cursorrules, etc.) file is a huge unlock for our AI colleagues Claude Code, Cursor, Gemini, and others.

After a number of iterations on ours, here’s what’s been working:

* First, we situate the agent with basic context by explaining the what and why of the app.
* Next, we explain how to do basic development tasks: add packages, run tests, etc.
* Next, we explain how any MCP servers should be used. We only use one: Playwright. We've found it to be invaluable for helping Claude make progress on tricky UI tasks.

We then continue explaining the how and where of our app.

* Debugging is like half the job, so we explain how to do it well.
* We then give the bird's eye view of the business logic, and point to several files that are its cornerstones. We also point out files that are representative of our favorite patterns. Claude will not read these right away, but it will know what to consult when needed.
* Lastly, we state our preference for less comments and giving things clear names. 🙂

And that's it. The shorter, the better, as context is still precious.

AI agents now write most of the code of our app. But this is only possible with clear guidance from experienced devs, which starts with CLAUDE.md.

You can see the entire file in this [Gist](https://gist.github.com/sergeyk/b5f1fe0a1414f3049d65e6c5acf68b2a) and read a more detailed write-up on [our blog](https://www.superconductor.dev/blog/the-value-of-claude-md/). Would be curious to see yours!

![img](c77c28weu9gf1)

