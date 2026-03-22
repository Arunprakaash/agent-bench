import type { ReactNode } from "react";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import styles from "./index.module.css";

function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroBadge}>Open Source · Free to Self-Host</div>
        <h1 className={styles.heroTitle}>
          Test your AI agents
          <br />
          <span className={styles.heroAccent}>before they break in prod</span>
        </h1>
        <p className={styles.heroSub}>
          Bench is an open-source evaluation platform for multi-turn
          conversational agents. Define scenarios, run them against your agent,
          and catch regressions before they reach users.
        </p>
        <div className={styles.heroCtas}>
          <Link className={styles.ctaPrimary} to="/docs/intro">
            Get Started
          </Link>
          <Link
            className={styles.ctaSecondary}
            href="https://github.com/agentbench/bench"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            View on GitHub
          </Link>
        </div>
        <div className={styles.heroNote}>
          No vendor lock-in · Self-host in minutes · Works with any agent
        </div>
      </div>
      <div className={styles.heroVisual}>
        <TerminalWindow />
      </div>
    </section>
  );
}

function TerminalWindow() {
  return (
    <div className={styles.terminal}>
      <div className={styles.terminalBar}>
        <span className={styles.dot} style={{ background: "#ff5f57" }} />
        <span className={styles.dot} style={{ background: "#ffbd2e" }} />
        <span className={styles.dot} style={{ background: "#28c840" }} />
        <span className={styles.terminalTitle}>bench run</span>
      </div>
      <div className={styles.terminalBody}>
        <p>
          <span className={styles.tc}>$</span> bench run --scenario
          &quot;booking-flow&quot;
        </p>
        <br />
        <p>
          <span className={styles.tdim}>Running 6 turns against agent...</span>
        </p>
        <br />
        <p>
          <span className={styles.tgreen}>✔</span> T1 Greet and confirm intent
        </p>
        <p>
          <span className={styles.tgreen}>✔</span> T2 Collect travel dates
        </p>
        <p>
          <span className={styles.tgreen}>✔</span> T3 Call search_flights tool
        </p>
        <p>
          <span className={styles.tgreen}>✔</span> T4 Present options to user
        </p>
        <p>
          <span className={styles.tred}>✘</span> T5 Confirm booking details
          <span className={styles.tdim}> — wrong price quoted</span>
        </p>
        <p>
          <span className={styles.tdim}>  Expected: "Total is $842"</span>
        </p>
        <p>
          <span className={styles.tdim}>  Got:      "Total is $812"</span>
        </p>
        <br />
        <p>
          <span className={styles.tred}>✘ 1 turn failed</span>
          <span className={styles.tdim}> · 4/5 passed · 1.4s</span>
        </p>
      </div>
    </div>
  );
}

const features = [
  {
    icon: "💬",
    title: "Multi-turn scenarios",
    desc: "Define full conversation flows — not just single prompts. Test how your agent handles context, follow-ups, and corrections across many turns.",
  },
  {
    icon: "🧠",
    title: "LLM-based evaluation",
    desc: "No brittle string matching. An LLM judge evaluates semantic intent — so minor rephrasing doesn't break your tests.",
  },
  {
    icon: "🔁",
    title: "Regression detection",
    desc: "Get alerted when a previously passing scenario starts failing. Catch model updates or infrastructure changes before users do.",
  },
  {
    icon: "⚡",
    title: "CI/CD ready",
    desc: "Trigger runs from GitHub Actions or any CI system via REST API. Block deploys when agent quality drops.",
  },
  {
    icon: "📋",
    title: "Failures inbox",
    desc: "Triage failed runs from a single inbox. See exactly which turn failed and why — with the judge's reasoning inline.",
  },
  {
    icon: "🔌",
    title: "Connect any agent",
    desc: "Works with any HTTP endpoint. Not locked to a framework, model, or cloud. If it speaks HTTP, Bench can test it.",
  },
];

function Features() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <h2 className={styles.sectionTitle}>Everything you need to test agents</h2>
        <p className={styles.sectionSub}>
          Built for teams shipping conversational AI to production.
        </p>
        <div className={styles.featureGrid}>
          {features.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <h3 className={styles.featureCardTitle}>{f.title}</h3>
              <p className={styles.featureCardDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    num: "01",
    title: "Connect your agent",
    desc: "Point Bench at any HTTP endpoint. Add headers, configure the model, set up health checks.",
  },
  {
    num: "02",
    title: "Write scenarios",
    desc: "Define multi-turn conversations with per-turn expectations — messages, tool calls, or agent handoffs.",
  },
  {
    num: "03",
    title: "Run and evaluate",
    desc: "Bench executes each turn, collects agent responses, and runs LLM-based evaluation on every expectation.",
  },
  {
    num: "04",
    title: "Catch regressions",
    desc: "Schedule runs, integrate with CI, and get alerted when agent quality drops.",
  },
];

function HowItWorks() {
  return (
    <section className={styles.sectionAlt}>
      <div className={styles.sectionInner}>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <p className={styles.sectionSub}>
          From agent to coverage in minutes.
        </p>
        <div className={styles.steps}>
          {steps.map((s, i) => (
            <div key={s.num} className={styles.step}>
              <div className={styles.stepNum}>{s.num}</div>
              {i < steps.length - 1 && (
                <div className={styles.stepLine} aria-hidden="true" />
              )}
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CodeSnippet() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionInner}>
        <div className={styles.codeRow}>
          <div className={styles.codeLeft}>
            <h2 className={styles.sectionTitle}>Works with any stack</h2>
            <p className={styles.sectionSub}>
              Implement one endpoint and Bench handles the rest — orchestration,
              evaluation, history, alerts.
            </p>
            <ul className={styles.codeFeatureList}>
              <li>✓ Node.js, Python, Go, or any language</li>
              <li>✓ OpenAI, Anthropic, or any model</li>
              <li>✓ Custom headers and auth</li>
              <li>✓ Tool calls and agent handoffs</li>
            </ul>
            <Link className={styles.ctaSecondary} to="/docs/intro">
              Read the integration guide →
            </Link>
          </div>
          <div className={styles.codeRight}>
            <div className={styles.codeBlock}>
              <div className={styles.codeHeader}>
                <span className={styles.codeLang}>Python</span>
              </div>
              <pre className={styles.codePre}>
                <code>{`from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class TurnRequest(BaseModel):
    messages: list[dict]
    config: dict

@app.post("/bench/run")
async def run(req: TurnRequest):
    response = await my_agent.chat(
        messages=req.messages
    )
    return {
        "events": [{
            "type": "message",
            "content": response.text
        }]
    }`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className={styles.ctaSection}>
      <div className={styles.ctaInner}>
        <h2 className={styles.ctaTitle}>Start testing your agent today</h2>
        <p className={styles.ctaSub}>
          Open source, self-hosted, no credit card required.
        </p>
        <div className={styles.heroCtas}>
          <Link className={styles.ctaPrimary} to="/docs/intro">
            Read the docs
          </Link>
          <Link
            className={styles.ctaSecondary}
            href="https://github.com/agentbench/bench"
          >
            Star on GitHub
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Bench — AI Agent Testing Platform"
      description="Open-source evaluation platform for multi-turn conversational agents. Define scenarios, run them against your agent, and catch regressions before they reach users."
    >
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CodeSnippet />
        <CTA />
      </main>
    </Layout>
  );
}
