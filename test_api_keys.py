#!/usr/bin/env python3
"""
API Key Tester Script
This script tests both OpenAI and Perplexity API keys to confirm they're working correctly.
Keys can be loaded from a .env file or entered manually.
"""

import requests
import json
import sys
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def test_openai_key(api_key):
    """Test an OpenAI API key by making a simple chat completion request."""
    print("\n---------------------")
    print("Testing OpenAI API Key")
    print("---------------------")
    
    if not api_key:
        print("❌ No API key provided")
        return False
        
    print(f"🔑 Using key: {api_key[:5]}...{api_key[-4:] if len(api_key) > 9 else ''}")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Say hello"}],
        "max_tokens": 10
    }
    
    try:
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        # Print the response status code
        print(f"📡 API response status code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            print(f"✅ Success! Response: '{content.strip()}'")
            return True
        else:
            try:
                error_data = response.json()
                error_message = error_data.get("error", {}).get("message", "Unknown error")
                print(f"❌ Error: {error_message}")
            except:
                print(f"❌ Error: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception occurred: {e}")
        return False

def test_perplexity_key(api_key):
    """Test a Perplexity API key by making a simple completion request."""
    print("\n-------------------------")
    print("Testing Perplexity API Key")
    print("-------------------------")
    
    if not api_key:
        print("❌ No API key provided")
        return False
        
    print(f"🔑 Using key: {api_key[:5]}...{api_key[-4:] if len(api_key) > 9 else ''}")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "model": "sonar",
        "messages": [{"role": "user", "content": "Say hello"}]
    }
    
    try:
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers=headers,
            json=payload,
            timeout=10
        )
        
        # Print the response status code
        print(f"📡 API response status code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            print(f"✅ Success! Response: '{content[:50].strip()}...'")
            return True
        else:
            try:
                error_data = response.json()
                error_message = error_data.get("error", {}).get("message", "Unknown error")
                print(f"❌ Error: {error_message}")
            except:
                print(f"❌ Error: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Exception occurred: {e}")
        return False

def main():
    """Get API keys from .env file or user input and test them."""
    print("=================================")
    print("API Key Tester for SwarmWeaver")
    print("=================================")
    
    # Try to get API keys from environment variables first
    openai_key = os.getenv("OPENAI_API_KEY", "")
    perplexity_key = os.getenv("PERPLEXITY_API_KEY", "")
    
    # If keys aren't in environment variables, prompt the user
    if not openai_key:
        openai_key = input("Enter your OpenAI API Key (or press Enter to skip): ").strip()
    else:
        print("OpenAI API Key found in environment variables")
        
    if not perplexity_key:
        perplexity_key = input("Enter your Perplexity API Key (or press Enter to skip): ").strip()
    else:
        print("Perplexity API Key found in environment variables")
    
    if not openai_key and not perplexity_key:
        print("\n❌ No API keys provided. Exiting.")
        return
    
    if openai_key:
        openai_result = test_openai_key(openai_key)
    
    if perplexity_key:
        perplexity_result = test_perplexity_key(perplexity_key)
    
    print("\n=================================")
    print("Summary:")
    if openai_key:
        print(f"OpenAI API Key: {'✅ Valid' if openai_result else '❌ Invalid'}")
    if perplexity_key:
        print(f"Perplexity API Key: {'✅ Valid' if perplexity_result else '❌ Invalid'}")
    print("=================================")

if __name__ == "__main__":
    main()
