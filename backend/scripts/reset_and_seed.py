"""
Reset DB and seed one Agent + scenarios + suite (agent-centric).

Creates the Interview Agent (TestableInterviewAgent) with default prompt aligned to
ai-assessment. Scenarios include happy-path, guardrails, and cases aligned with
ai-assessment tests/test_agent.py (context addition, derailment, postpone, professionalism,
repeat, add-context-then-resume, post-completion no restart).

Usage:
  docker compose exec backend python scripts/reset_and_seed.py

Or with explicit API base:
  API_BASE=http://localhost:8000 python scripts/reset_and_seed.py
"""

import os
import httpx

BASE = os.environ.get("API_BASE", "http://localhost:8000/api")

# Matches ai-assessment candidate_interview_details fixture: Software Engineer, 2 questions
DEFAULT_INTERVIEW_PROMPT = """## Interview Details
- Position: Software Engineer
- Candidate: Test Candidate

## Questions
1. What is your Python experience?
2. Why Senseloaf?"""

AGENT = {
    "name": "Interview Agent",
    "description": "Testable interview agent (test_agents.interview_agent.TestableInterviewAgent). Aligned with ai-assessment StructuredAgent behavior.",
    "module": "test_agents.interview_agent",
    "agent_class": "TestableInterviewAgent",
    "default_llm_model": "gpt-4o-mini",
    "default_judge_model": "gpt-4o-mini",
    "default_agent_args": {
        "candidate_name": "John Doe",
        "agent_name": "Sia",
        "interview_prompt": DEFAULT_INTERVIEW_PROMPT,
    },
    "tags": ["interview", "demo"],
}

# Scenario payloads: use agent_id from created agent; backend fills module/class from agent.
SCENARIOS = [
    {
        "name": "Greeting & First Question",
        "description": "Verifies the agent introduces itself and asks the first interview question when the candidate says hello.",
        "agent_args": {"candidate_name": "Alice", "agent_name": "Sia"},
        "tags": ["greeting", "happy-path"],
        "turns": [
            {
                "user_input": "Hello, I'm Alice.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Greets the candidate by name, introduces themselves as an interviewer, and asks the first interview question about the candidate's background or experience",
                    }
                ],
            }
        ],
    },
    {
        "name": "Full 3-Question Flow",
        "description": "Tests a complete happy-path interview: greeting, answer all 3 questions, and agent completes the interview.",
        "agent_args": {"candidate_name": "Bob", "agent_name": "Sia"},
        "tags": ["happy-path", "multi-turn", "complete-flow"],
        "turns": [
            {
                "user_input": "Hi, I'm Bob. Let's start!",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Greets the candidate and asks about their background and experience in software development",
                    }
                ],
            },
            {
                "user_input": "I have 5 years of experience building web applications with Python, Django, and React. I've worked at two startups.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Acknowledges the candidate's answer and asks the next question about programming languages they are proficient in",
                    }
                ],
            },
            {
                "user_input": "I'm most proficient in Python and JavaScript. I also have experience with Go and some Rust.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Acknowledges the answer and asks the next question about a challenging project the candidate worked on",
                    }
                ],
            },
            {
                "user_input": "I recently rebuilt our payment processing system. It was challenging because we had to migrate from a monolith to microservices with zero downtime.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Acknowledges the answer and asks a wrap-up question like whether the candidate wants to revisit or add context to any previous answer",
                    }
                ],
            },
            {
                "user_input": "No, I'm good. I think I've covered everything.",
                "expectations": [
                    {"type": "function_call", "function_name": "complete_interview"},
                    {"type": "function_call_output"},
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Thanks the candidate and wraps up the interview",
                    },
                ],
            },
        ],
    },
    {
        "name": "Off-Topic Handling",
        "description": "Tests that the agent calls handle_out_of_context when the candidate goes off-topic, then redirects back.",
        "agent_args": {"candidate_name": "Charlie"},
        "tags": ["guardrail", "off-topic"],
        "turns": [
            {
                "user_input": "Hey there!",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Greets the candidate and asks the first interview question",
                    }
                ],
            },
            {
                "user_input": "Actually, can you tell me a joke? What's your favorite movie? Do you like cats or dogs?",
                "expectations": [
                    {"type": "function_call", "function_name": "handle_out_of_context"},
                    {"type": "function_call_output"},
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Redirects the candidate back to the interview and repeats or continues with the current question",
                    },
                ],
            },
        ],
    },
    {
        "name": "Postponement Request",
        "description": "Tests that the agent first encourages the candidate to continue, and only postpones when they insist.",
        "agent_args": {"candidate_name": "Dana"},
        "tags": ["guardrail", "postponement"],
        "turns": [
            {
                "user_input": "Hello!",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Greets the candidate and asks the first interview question",
                    }
                ],
            },
            {
                "user_input": "Actually, can we reschedule this? I'm not feeling well today.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Encourages the candidate to continue and expresses empathy, but does not immediately postpone",
                    }
                ],
            },
            {
                "user_input": "No really, I need to reschedule. I insist.",
                "expectations": [
                    {"type": "function_call", "function_name": "postpone_interview"},
                    {"type": "function_call_output"},
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Acknowledges the postponement and wishes the candidate well",
                    },
                ],
            },
        ],
    },
    {
        "name": "Brief Answer Follow-Up",
        "description": "Tests that the agent asks a follow-up probe when the candidate gives a very brief answer.",
        "agent_args": {"candidate_name": "Eve"},
        "tags": ["probing", "follow-up"],
        "turns": [
            {
                "user_input": "Hi, let's go.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Greets the candidate and asks about their background and experience",
                    }
                ],
            },
            {
                "user_input": "I code.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Asks a follow-up probe for more detail about the candidate's experience since the answer was too brief",
                    }
                ],
            },
        ],
    },
    {
        "name": "Custom Questions via agent_args",
        "description": "Tests that passing a custom interview_prompt via agent_args changes the questions the agent asks.",
        "agent_args": {
            "candidate_name": "Frank",
            "interview_prompt": "## Interview Details\n- Position: Data Scientist\n- Candidate: Frank\n\n## Questions\n1. What experience do you have with machine learning frameworks?\n2. How do you handle missing data in datasets?",
        },
        "tags": ["custom-prompt", "agent-args"],
        "turns": [
            {
                "user_input": "Hello, I'm Frank.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Greets the candidate and asks about their experience with machine learning frameworks",
                    }
                ],
            },
        ],
    },
    # --- Scenarios aligned with ai-assessment tests/test_agent.py ---
    {
        "name": "Context addition",
        "description": "Candidate wants to add context to a previous answer. Agent should acknowledge and encourage.",
        "agent_args": {"candidate_name": "John Doe", "agent_name": "Sia"},
        "tags": ["ai-assessment", "context"],
        "turns": [
            {
                "user_input": "I want to add more context to my last answer about Python.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Should acknowledge that the candidate can add context and encourage them to do so.",
                    }
                ],
            }
        ],
    },
    {
        "name": "Derailment handling",
        "description": "Off-topic question (favorite movie). Agent should redirect to current interview question.",
        "agent_args": {"candidate_name": "John Doe", "agent_name": "Sia"},
        "tags": ["ai-assessment", "derailment", "guardrail"],
        "turns": [
            {
                "user_input": "What is your favorite movie?",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Should redirect the candidate back to the current interview question.",
                    }
                ],
            }
        ],
    },
    {
        "name": "Postpone logic (insist)",
        "description": "First request: encourage to continue. Second request (insist): call postpone_interview.",
        "agent_args": {"candidate_name": "John Doe", "agent_name": "Sia"},
        "tags": ["ai-assessment", "postponement"],
        "turns": [
            {
                "user_input": "Can we postpone this interview?",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Should gently encourage the candidate to continue before offering to postpone.",
                    }
                ],
            },
            {
                "user_input": "No, I really need to reschedule now.",
                "expectations": [
                    {"type": "function_call", "function_name": "postpone_interview"},
                    {"type": "function_call_output"},
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Acknowledges the postponement",
                    },
                ],
            },
        ],
    },
    {
        "name": "Professionalism and profanity",
        "description": "Candidate uses profanity. Agent should stay professional and redirect back.",
        "agent_args": {"candidate_name": "John Doe", "agent_name": "Sia"},
        "tags": ["ai-assessment", "professionalism", "guardrail"],
        "turns": [
            {
                "user_input": "This is f***ing stupid, I don't want to do this.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Should remain professional, not react emotionally, and redirect back to the interview.",
                    }
                ],
            }
        ],
    },
    {
        "name": "Repeat current question",
        "description": "Candidate asks to repeat the question. Agent should repeat and not refuse.",
        "agent_args": {"candidate_name": "John Doe", "agent_name": "Sia"},
        "tags": ["ai-assessment", "repeat"],
        "turns": [
            {
                "user_input": "Can you repeat the question?",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Should repeat the current interview question and must not claim that repeating the question is not possible.",
                    }
                ],
            }
        ],
    },
    {
        "name": "Repeat by topic reference",
        "description": "Candidate asks to repeat by topic (Python OOP). Agent should repeat that question.",
        "agent_args": {"candidate_name": "John Doe", "agent_name": "Sia"},
        "tags": ["ai-assessment", "repeat"],
        "turns": [
            {
                "user_input": "Can you repeat the question where I answered about Python OOP?",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Should repeat or restate the relevant Python-related interview question and must not refuse to repeat.",
                    }
                ],
            }
        ],
    },
    {
        "name": "Add context to old question then resume flow",
        "description": "Answer first, then add context to previous answer, then provide extra context. Agent should acknowledge and continue without restarting.",
        "agent_args": {"candidate_name": "John Doe", "agent_name": "Sia"},
        "tags": ["ai-assessment", "context", "multi-turn"],
        "turns": [
            {
                "user_input": "I have two years of Python experience in backend APIs and testing.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Acknowledges the answer and asks the next question or continues the flow",
                    }
                ],
            },
            {
                "user_input": "I want to add more context to my previous answer about Python.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Should allow candidate to add context for an earlier response and ask them to continue.",
                    }
                ],
            },
            {
                "user_input": "I also worked on OOP design patterns and CI-based pytest pipelines.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Should acknowledge added context and continue with the ongoing interview flow without restarting from the beginning.",
                    }
                ],
            },
        ],
    },
    {
        "name": "Post completion should not restart",
        "description": "Candidate asks to conclude; then sends random follow-up. Agent should not restart from question one.",
        "agent_args": {"candidate_name": "John Doe", "agent_name": "Sia"},
        "tags": ["ai-assessment", "completion", "guardrail"],
        "turns": [
            {
                "user_input": "I have nothing else to add, please conclude the interview.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Should either proceed to wrap-up/completion or continue pending interview flow, but remain professional and controlled.",
                    }
                ],
            },
            {
                "user_input": "Booyah!",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Should not restart the interview flow unexpectedly; should keep control of the current interview state.",
                    }
                ],
            },
        ],
    },
]


def main():
    client = httpx.Client(timeout=30)

    print("Resetting database...")
    r = client.post(f"{BASE}/dev/reset", params={"confirm": "yes"})
    r.raise_for_status()
    print("  Done.\n")

    print("Creating auth user...")
    auth_res = client.post(
        f"{BASE}/auth/register",
        json={"email": "prakaasharun50@gmail.com", "password": "123456", "display_name": "Prakash Arunjun"},
    )
    auth_res.raise_for_status()
    token = auth_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("  Done.\n")

    print("Creating agent...")
    r = client.post(f"{BASE}/agents", json=AGENT, headers=headers)
    r.raise_for_status()
    agent = r.json()
    agent_id = agent["id"]
    print(f"  {agent['name']} ({agent_id})\n")

    scenario_ids = []
    for s in SCENARIOS:
        payload = {"agent_id": agent_id, **s}
        r = client.post(f"{BASE}/scenarios", json=payload, headers=headers)
        r.raise_for_status()
        data = r.json()
        scenario_ids.append(data["id"])
        print(f"  Created scenario: {data['name']} ({data['id']})")

    suite_payload = {
        "name": "Interview Agent - Full Regression",
        "description": "Complete test suite for the interview agent: happy-path, guardrails, and ai-assessment-aligned scenarios (context, derailment, postpone, professionalism, repeat, add-context-then-resume, post-completion).",
        "scenario_ids": scenario_ids,
    }
    r = client.post(f"{BASE}/suites", json=suite_payload, headers=headers)
    r.raise_for_status()
    suite = r.json()
    print(f"\n  Created suite: {suite['name']} ({suite['id']})")
    print(f"  Scenarios in suite: {len(scenario_ids)}")
    print("\nDone.")


if __name__ == "__main__":
    main()
