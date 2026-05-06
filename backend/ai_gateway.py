import os
import json
import asyncio
from typing import List, Optional, Any
from openai import AsyncOpenAI
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

async def generate_chat_stream(messages: list, provider: str, injected_response: str = None, tools: list = None, tool_choice: Any = "auto", use_research: bool = False):
    if provider == "debug":
        if injected_response:
            words = injected_response.split(" ")
            for word in words:
                yield {"type": "content", "data": word + " "}
                await asyncio.sleep(0.05)
        return

    client = None
    model = ""

    if provider == "deepseek":
        client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")
        model = "deepseek-chat"
        print(f"\n📡 [STREAM] PROVIDER: DeepSeek")
        print(f"🤖 MODEL: {model}\n")
    elif provider == "openrouter":
        client = AsyncOpenAI(api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")
        model = "google/gemini-2.0-flash-001"
        print(f"\n📡 [STREAM] PROVIDER: OpenRouter")
        print(f"🤖 MODEL: {model}")
        print(f"🔍 RESEARCH MODE: {'ON (Using Tools)' if use_research else 'OFF'}\n")
    else:
        yield {"type": "error", "data": f"Unknown provider: {provider}"}
        return

    # If research is enabled, merge the strict instruction into the existing system prompt or prepend it
    if use_research:
        research_instr = "CRITICAL: Research Mode is ACTIVE. You are FORBIDDEN from proposing a syllabus or answering career-path questions without first calling the 'research_market_demands' tool. Use it NOW."
        if messages and messages[0]["role"] == "system":
            messages[0]["content"] = research_instr + "\n\n" + messages[0]["content"]
        else:
            messages = [{"role": "system", "content": research_instr}] + messages
    
    # Debug: Print the merged system prompt for verification
    if messages and messages[0]["role"] == "system":
        print(f"DEBUG: Merged System Prompt: {messages[0]['content'][:200]}...")

    kwargs = {
        "model": model,
        "messages": messages,
        "stream": True,
    }
    
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = tool_choice

    try:
        stream = await client.chat.completions.create(**kwargs)
        
        tool_call_name = ""
        tool_call_args = ""
        is_tool_call = False

        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            
            if delta.tool_calls:
                is_tool_call = True
                tool_call = delta.tool_calls[0]
                if tool_call.function.name:
                    tool_call_name = tool_call.function.name
                if tool_call.function.arguments:
                    tool_call_args += tool_call.function.arguments
            elif delta.content and not is_tool_call:
                print(f"DEBUG: Chunk received ({len(delta.content)} chars)")
                yield {"type": "content", "data": delta.content}
                
        if is_tool_call:
            yield {
                "type": "tool_call",
                "name": tool_call_name,
                "arguments": tool_call_args
            }
            
    except Exception as e:
        print(f"❌ [AI_GATEWAY] FATAL ERROR: {str(e)}")
        yield {"type": "error", "data": f"Gateway Error: {str(e)}"}

async def fetch_market_research(goal: str, location: str, use_openrouter: bool) -> str:
    research_prompt = f"""You are an expert tech industry recruiter and market analyst.
The user's career goal is: "{goal}". 
Their target location/market is: "{location}".

Conduct an in-depth analysis of the current market demands for this specific goal. 
Return a concise but highly detailed summary including:
1. Top 5 must-have technical skills currently demanded by companies.
2. Required tools, frameworks, or languages.
3. Common interview expectations or portfolio requirements.
"""
    
    messages = [{"role": "user", "content": research_prompt}]
    
    if use_openrouter:
        client = AsyncOpenAI(api_key=OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")
        model = "perplexity/sonar"
        print(f"\n🚀 [AI_GATEWAY] ROUTING TO OPENROUTER")
        print(f"📡 MODEL: {model}")
        print(f"🔗 URL: https://openrouter.ai/api/v1\n")
    else:
        client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")
        model = "deepseek-chat"
        print(f"\n🧊 [AI_GATEWAY] ROUTING TO DEEPSEEK")
        print(f"📡 MODEL: {model}\n")
        
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=messages
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Market Research LLM Error: {str(e)}")
        return f"Market research temporarily unavailable. Defaulting to general industry standards for {goal}."
