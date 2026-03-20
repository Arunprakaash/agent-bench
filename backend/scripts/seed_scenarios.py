"""
Seed script: creates test scenarios and a suite via the API.

Usage:
  docker compose exec backend python scripts/seed_scenarios.py
"""

import httpx
import json

BASE = "http://localhost:8000/api"

SCENARIOS = [
    {
        "name": "Greeting & First Question",
        "description": "Verifies the agent introduces itself and asks the first interview question when the candidate says hello.",
        "agent_module": "test_agents.interview_agent",
        "agent_class": "TestableInterviewAgent",
        "llm_model": "gpt-4o-mini",
        "judge_model": "gpt-4o-mini",
        "agent_args": {"candidate_name": "Alice", "agent_name": "Sia"},
        "tags": ["greeting", "happy-path"],
        "turns": [
            {
                "user_input": "Hello, I'm Alice.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Greets the candidate by name, introduces themselves as an interviewer, and asks the first interview question about the candidate's background or experience"
                    }
                ]
            }
        ]
    },
    {
        "name": "Full 3-Question Flow",
        "description": "Tests a complete happy-path interview: greeting, answer all 3 questions, and agent completes the interview.",
        "agent_module": "test_agents.interview_agent",
        "agent_class": "TestableInterviewAgent",
        "llm_model": "gpt-4o-mini",
        "judge_model": "gpt-4o-mini",
        "agent_args": {"candidate_name": "Bob", "agent_name": "Sia"},
        "tags": ["happy-path", "multi-turn", "complete-flow"],
        "turns": [
            {
                "user_input": "Hi, I'm Bob. Let's start!",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Greets the candidate and asks about their background and experience in software development"
                    }
                ]
            },
            {
                "user_input": "I have 5 years of experience building web applications with Python, Django, and React. I've worked at two startups.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Acknowledges the candidate's answer and asks the next question about programming languages they are proficient in"
                    }
                ]
            },
            {
                "user_input": "I'm most proficient in Python and JavaScript. I also have experience with Go and some Rust.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Acknowledges the answer and asks the next question about a challenging project the candidate worked on"
                    }
                ]
            },
            {
                "user_input": "I recently rebuilt our payment processing system. It was challenging because we had to migrate from a monolith to microservices with zero downtime.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Acknowledges the answer and asks a wrap-up question like whether the candidate wants to revisit or add context to any previous answer"
                    }
                ]
            },
            {
                "user_input": "No, I'm good. I think I've covered everything.",
                "expectations": [
                    {
                        "type": "function_call",
                        "function_name": "complete_interview"
                    },
                    {
                        "type": "function_call_output"
                    },
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Thanks the candidate and wraps up the interview"
                    }
                ]
            }
        ]
    },
    {
        "name": "Off-Topic Handling",
        "description": "Tests that the agent calls handle_out_of_context when the candidate goes off-topic, then redirects back.",
        "agent_module": "test_agents.interview_agent",
        "agent_class": "TestableInterviewAgent",
        "llm_model": "gpt-4o-mini",
        "judge_model": "gpt-4o-mini",
        "agent_args": {"candidate_name": "Charlie"},
        "tags": ["guardrail", "off-topic"],
        "turns": [
            {
                "user_input": "Hey there!",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Greets the candidate and asks the first interview question"
                    }
                ]
            },
            {
                "user_input": "Actually, can you tell me a joke? What's your favorite movie? Do you like cats or dogs?",
                "expectations": [
                    {
                        "type": "function_call",
                        "function_name": "handle_out_of_context"
                    },
                    {
                        "type": "function_call_output"
                    },
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Redirects the candidate back to the interview and repeats or continues with the current question"
                    }
                ]
            }
        ]
    },
    {
        "name": "Postponement Request",
        "description": "Tests that the agent first encourages the candidate to continue, and only postpones when they insist.",
        "agent_module": "test_agents.interview_agent",
        "agent_class": "TestableInterviewAgent",
        "llm_model": "gpt-4o-mini",
        "judge_model": "gpt-4o-mini",
        "agent_args": {"candidate_name": "Dana"},
        "tags": ["guardrail", "postponement"],
        "turns": [
            {
                "user_input": "Hello!",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Greets the candidate and asks the first interview question"
                    }
                ]
            },
            {
                "user_input": "Actually, can we reschedule this? I'm not feeling well today.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Encourages the candidate to continue and expresses empathy, but does not immediately postpone"
                    }
                ]
            },
            {
                "user_input": "No really, I need to reschedule. I insist.",
                "expectations": [
                    {
                        "type": "function_call",
                        "function_name": "postpone_interview"
                    },
                    {
                        "type": "function_call_output"
                    },
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Acknowledges the postponement and wishes the candidate well"
                    }
                ]
            }
        ]
    },
    {
        "name": "Brief Answer Follow-Up",
        "description": "Tests that the agent asks a follow-up probe when the candidate gives a very brief answer.",
        "agent_module": "test_agents.interview_agent",
        "agent_class": "TestableInterviewAgent",
        "llm_model": "gpt-4o-mini",
        "judge_model": "gpt-4o-mini",
        "agent_args": {"candidate_name": "Eve"},
        "tags": ["probing", "follow-up"],
        "turns": [
            {
                "user_input": "Hi, let's go.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Greets the candidate and asks about their background and experience"
                    }
                ]
            },
            {
                "user_input": "I code.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Asks a follow-up probe for more detail about the candidate's experience since the answer was too brief"
                    }
                ]
            }
        ]
    },
    {
        "name": "Custom Questions via agent_args",
        "description": "Tests that passing a custom interview_prompt via agent_args changes the questions the agent asks.",
        "agent_module": "test_agents.interview_agent",
        "agent_class": "TestableInterviewAgent",
        "llm_model": "gpt-4o-mini",
        "judge_model": "gpt-4o-mini",
        "agent_args": {
            "candidate_name": "Frank",
            "interview_prompt": "## Interview Details\n- Position: Data Scientist\n- Candidate: Frank\n\n## Questions\n1. What experience do you have with machine learning frameworks?\n2. How do you handle missing data in datasets?"
        },
        "tags": ["custom-prompt", "agent-args"],
        "turns": [
            {
                "user_input": "Hello, I'm Frank.",
                "expectations": [
                    {
                        "type": "message",
                        "role": "assistant",
                        "intent": "Greets the candidate and asks about their experience with machine learning frameworks"
                    }
                ]
            }
        ]
    }
]


def main():
    client = httpx.Client(timeout=10)

    scenario_ids = []
    for s in SCENARIOS:
        resp = client.post(f"{BASE}/scenarios", json=s)
        resp.raise_for_status()
        data = resp.json()
        scenario_ids.append(data["id"])
        print(f"  Created scenario: {data['name']} ({data['id']})")

    suite_payload = {
        "name": "Interview Agent - Full Regression",
        "description": "Complete test suite for the interview agent covering greeting, multi-turn flow, off-topic handling, postponement, brief answers, and custom prompts.",
        "scenario_ids": scenario_ids,
    }
    resp = client.post(f"{BASE}/suites", json=suite_payload)
    resp.raise_for_status()
    suite = resp.json()
    print(f"\n  Created suite: {suite['name']} ({suite['id']})")
    print(f"  Scenarios in suite: {len(scenario_ids)}")

    print("\nDone!")


if __name__ == "__main__":
    main()
