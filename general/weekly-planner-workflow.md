# Weekly Planner Workflow
## Performance rating: Unknown

## Objective:
A multi-step Chat LLM workflow that takes your Google Calendar (screenshot) + carry-over tasks, jogs your memory, compiles and prioritizes everything via an Eisenhower matrix, time-boxes it into a 9–5 week (with today’s plan), and then gives you a daily check-in template so you can iterate seamlessly each week and every morning.

## How To Use
1. Use the `Weekly Planning` set of prompts to walk you through the weekly planning stage at the start of your week.
2. Use the `Daily Check-in Template` to make any updates to the day and week's priorities each morning as you work through the week. 

## Prompts

### Weekly Planning:
#### Stage 1: Input Gathering
```
You’re my planning assistant. I’ve just shared:
- A Google Calendar week-view screenshot  
- A list of carry-over todos from last week  

Ignore or repurpose any slots labelled “Day Loading…”, “Day Cap” or “PRs and comms Catchup.”  
Please confirm receipt and then ask any clarifying questions you need before we start planning.
```

#### Stage 2: Memory-Jog Questions
```
You have my calendar and list of carry-overs.  
Now ask a concise, targeted set of questions (bullet style) to surface anything missing—deadlines, meetings, personal errands, milestones, recurring check-ins, etc.
```

#### Stage 3: Raw Task List
```
Using my calendar entries and your answers to the questions, compile a flat list of every distinct task or commitment.  
Format as short bullet points, no prioritization yet.
```

#### Stage 4: Eisenhower Matrix Classification
```
Take the raw task list and assign each item to one of four quadrants:
1. Important & Urgent  
2. Important & Not Urgent  
3. Not Important & Urgent  
4. Not Important & Not Urgent  

Present as a table with columns: Task | Quadrant.
```

#### Stage 5: Weekly & Today Time-Boxing
```
You now have tasks classified.  
– Estimate a duration for each.  
– Fit them into my 9–5 workweek and produce a high-level weekly grid.  
– Extract today’s items into a detailed, time-ranged bulleted plan for today.
```

⸻

### Daily Check-In Template
```
Create a daily morning check-in template I can reuse each day.  
Include questions for:
- What got completed yesterday?  
- What’s still outstanding?  
- What new priorities appeared?  
- Any re-prioritization needed?
Format as a simple question list.
```
