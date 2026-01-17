#!/bin/bash
set -e

echo "--- Personal Context MCP Server Smoke Test ---"

read -p "Enter Base URL (default: http://localhost:3010): " BASE_URL
BASE_URL=${BASE_URL:-http://localhost:3010}

read -p "Enter Auth Code: " CODE
read -p "Enter Code Verifier: " CODE_VERIFIER
read -p "Enter Redirect URI (default: http://localhost:3010): " REDIRECT_URI
REDIRECT_URI=${REDIRECT_URI:-http://localhost:3010}

echo ""
echo "Step 1: Exchanging code for token..."

TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=$CODE&code_verifier=$CODE_VERIFIER&redirect_uri=$REDIRECT_URI")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')

if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Token Exchange Failed"
  echo "$TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Token Exchange - Success"
echo "Got Access Token: ${ACCESS_TOKEN: 0:20}..."

echo ""
echo "Step 2: Calling MCP List Tools..."

MCP_RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id": 1}')

TOOLS_COUNT=$(echo "$MCP_RESPONSE" | jq '. result. tools | length')

if [ "$TOOLS_COUNT" = "null" ]; then
  echo "❌ MCP Call Failed"
  echo "$MCP_RESPONSE"
  exit 1
fi

echo "✅ MCP List Tools - Success"
echo "Found $TOOLS_COUNT tools."

echo ""
echo "✅ SMOKE TEST PASSED"