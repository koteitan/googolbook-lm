#!/bin/bash

# dothemall.bash - Run all analysis tools in sequence
# This script executes all the googology wiki analysis tools in the correct order

set -e  # Exit on any error

echo "Starting all analysis tools..."
echo "=============================="

# Run contributors analysis
echo "1. Running contributors analysis..."
cd contributors
python3 contributors.py
cd ..
echo "✓ Contributors analysis completed"

# Run large pages analysis  
echo "2. Running large pages analysis..."
cd large-pages
python3 large-pages.py
cd ..
echo "✓ Large pages analysis completed"

# Run namespace analysis
echo "3. Running namespace analysis..."
cd namespaces
python3 namespaces.py
cd ..
echo "✓ Namespace analysis completed"

# Run random check
echo "4. Running random check..."
cd random
python3 random-check.py
cd ..
echo "✓ Random check completed"

echo "=============================="
echo "All analysis tools completed successfully!"
echo ""
echo "Generated files:"
echo "- tools/contributors/contributors.md"
echo "- tools/large-pages/large-pages.md"
echo "- tools/namespaces/namespaces.md"
echo "- tools/random/index.html"