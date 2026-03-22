const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:3000";
const API_URL = "http://localhost:8000";
const EMAIL = "prakaasharun50@gmail.com";
const PASSWORD = "123456";
const OUT_DIR = path.join(__dirname, "../docs/screenshots/readme");

async function getToken() {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await res.json();
  if (!data.token) throw new Error("Login failed: " + JSON.stringify(data));
  return data.token;
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const token = await getToken();
  console.log("✓ Logged in");

  const apiFetch = (path) =>
    fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  // Inject token into localStorage before navigating
  await page.goto(BASE_URL);
  await page.evaluate((t) => localStorage.setItem("auth_token", t), token);

  const shot = async (name, url, setup) => {
    console.log(`→ ${name}`);
    await page.goto(`${BASE_URL}${url}`, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(800);
    if (setup) await setup(page);
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
  };

  await shot("dashboard", "/");
  await shot("agents-list", "/agents");
  await shot("scenarios-list", "/scenarios");
  await shot("runs-list", "/runs");
  await shot("failures", "/failures");
  await shot("suites-list", "/suites");

  // Agent detail
  const agents = await apiFetch("/api/agents");
  if (agents?.length) {
    await shot("agent-detail", `/agents/${agents[0].id}`);
    const restAgent = agents.find((a) => a.provider_type === "rest_api");
    if (restAgent) {
      console.log("→ agent-external (with redaction)");
      await page.goto(`${BASE_URL}/agents/${restAgent.id}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(800);
      // Redact sensitive values in the connection config code block
      await page.evaluate(() => {
        const redact = (text) =>
          text
            .replace(/"Bearer [^"]+"/g, '"Bearer [REDACTED]"')
            .replace(/"[A-Za-z0-9]{20,}"/g, (m) => {
              // Only redact long hex/alphanumeric strings that look like IDs/tokens
              const inner = m.slice(1, -1);
              if (/^[a-f0-9]{16,}$/i.test(inner)) return '"[REDACTED]"';
              return m;
            });
        document.querySelectorAll("pre, code").forEach((el) => {
          el.childNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              node.textContent = redact(node.textContent);
            }
          });
          // also handle nested spans (syntax highlighting)
          el.querySelectorAll("span").forEach((span) => {
            span.textContent = redact(span.textContent);
          });
        });
      });
      await page.screenshot({ path: path.join(OUT_DIR, "agent-external.png") });
    }
  }

  // Scenario detail + versions dropdown open
  const scenarios = await apiFetch("/api/scenarios");
  if (scenarios?.length) {
    const sid = scenarios[0].id;
    await shot("scenario-detail", `/scenarios/${sid}`);
    await shot("scenario-versions", `/scenarios/${sid}`, async (p) => {
      const btn = p.getByRole("button", { name: /Versions/i });
      if (await btn.isVisible()) {
        await btn.click();
        await p.waitForTimeout(500);
      }
    });
  }

  // Suite detail
  const suites = await apiFetch("/api/suites");
  if (suites?.length) {
    await shot("suite-detail", `/suites/${suites[0].id}`);
  }

  // Run detail
  const runs = await apiFetch("/api/runs?limit=5");
  if (runs?.length) {
    await shot("run-detail", `/runs/${runs[0].id}`);
  }

  await browser.close();
  console.log(`\n✓ Screenshots saved to ${OUT_DIR}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
