---
title: "Nearly half of our metrics were about processes nobody ever graphed"
date: 2026-09-09
summary: "The config in the repo said one thing. Three hundred hosts were doing another. Here is how we found out, and what it was costing."
substackUrl: "https://praneethveep.substack.com/p/nearly-half-of-our-metrics-were-about"
---

For most of this year we were paying to store a family of metrics that nobody had ever put on a dashboard or an alert. When we finally counted, it was just under half of every data point our host agents sent.

I look after monitoring for a large company’s infrastructure. A few hundred virtual machines each run an OpenTelemetry Collector as the host agent. The agent config lives in a repo, it gets reviewed, and everyone treats that file as the truth about what the fleet is collecting. It wasn’t.

## How we noticed

Storage was growing faster than the host count. That’s usually the first sign that something is collecting more than it should, but “something” is a wide net. Instead of guessing, we asked the database what it was actually storing. One query, grouping data points by metric name prefix over a week.

The top line was `process.*`. Per-process CPU, memory, disk I/O and open handles, for every process on every host, every ten seconds. Just under half of all metric points. Below it, the usual suspects: `system.cpu`, `system.memory`, `system.network`, each a fraction of the size.

The second number was worse. Over eighty percent of the disk wasn’t the values at all. It was the attributes: the labels attached to each point, plus the IDs that index them. Per-process metrics are the worst case for this. Every point carries the process name, the PID, the owner, sometimes the full command line. The number is eight bytes. The labels describing it are hundreds.

## Why it happened

The reference config in the repo had the `process` scraper of the hostmetrics receiver turned off. That’s the default and it’s the right default. The config on the hosts had it tur­ned on.

That divergence must have crept in during an early rollout, on one host image, and then propagated as that image was cloned across the fleet. Nobody noticed, because the agent config is exactly the kind of thing you set once and stop looking at. It works. Metrics flow. No alert fires when you collect too much. The only signal is a storage bill nobody reads line by line, and by the time it’s big enough to notice, it’s been wrong for months.

## What it means

Two things, and only one of them is about money.

The obvious one: we were spending real storage on data with no reader. Turning the scraper back off across the fleet drops metric volume by roughly forty percent. Same infrastructure, same visibility, because nobody was looking at the per-process series anyway.

The one that stays with me: the repo lied and everyone believed it, for months, with no bad intent anywhere. The config was reviewed. The reference was correct. The gap was between the reference and the machines, and nothing was watching that gap. This is the same failure that sits under every “the AI gave a confident wrong answer” story. The map and the territory drift apart quietly, and confidence attaches to the map.

## What we changed

- **Turned the scraper off at the source.** Not a drop filter downstream. If the data has no reader, the cheapest place to stop it is before it leaves the host.
- **Started measuring collected-versus-queried.** The real question isn’t “how much are we collecting”, it’s “how much of what we collect does anyone ever look at”. That ratio is the one worth a dashboard, and it’s the one nobody builds first.
- **Stopped trusting the config file as evidence.** The agents are the inventory. If you want to know what the fleet collects, ask the fleet, not the repo.

If you run agents at any scale, go run that grouping query against your own telemetry store this week. Group by metric name, sort by count. I’d bet the top line surprises you, and I’d bet it’s something nobody asked for.
