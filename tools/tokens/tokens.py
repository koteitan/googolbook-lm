#!/usr/bin/env python3
"""
Token Counter for Googology Wiki MediaWiki XML

This script analyzes the Googology Wiki MediaWiki XML export to count tokens
using different tokenization methods and compares the results.
"""

import tiktoken
import os
import time
import re
from datetime import datetime
from typing import List

# Configuration
XML_FILE = '../../data/googology_pages_current.xml'
OUTPUT_FILE = 'tokens.md'
FETCH_LOG_FILE = '../../data/fetch_log.txt'
EXCLUDE_FILE = '../../exclude.md'

def load_excluded_namespaces(exclude_file_path: str) -> List[str]:
    """
    Load excluded namespaces from exclude.md file.
    
    Args:
        exclude_file_path: Path to the exclude.md file
        
    Returns:
        List of excluded namespace prefixes
    """
    excluded_namespaces = []
    try:
        with open(exclude_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('- `') and line.endswith(':`'):
                    # Extract namespace from lines like "- `User talk:`"
                    namespace = line[3:-2]  # Remove "- `" and "`:"
                    excluded_namespaces.append(namespace)
    except Exception as e:
        print(f"Warning: Could not load exclusions from {exclude_file_path}: {e}")
    return excluded_namespaces

def filter_excluded_content(content: str, excluded_namespaces: List[str]) -> str:
    """
    Filter out content sections that match excluded namespaces.
    This removes XML elements and sections that reference excluded namespace pages.
    
    Args:
        content: XML content to filter
        excluded_namespaces: List of excluded namespace prefixes
        
    Returns:
        Filtered content with excluded sections removed
    """
    if not excluded_namespaces:
        return content
    
    lines = content.split('\n')
    filtered_lines = []
    
    for line in lines:
        # Check if line contains references to excluded namespaces
        should_exclude = False
        for namespace in excluded_namespaces:
            # Look for namespace references in various formats
            if f"{namespace}:" in line or f"{namespace} " in line:
                should_exclude = True
                break
        
        if not should_exclude:
            filtered_lines.append(line)
    
    return '\n'.join(filtered_lines)

def get_fetch_date() -> str:
    """
    Get the fetch date from the fetch log file.
    
    Returns:
        Fetch date string, or 'Unknown' if not available
    """
    try:
        with open(FETCH_LOG_FILE, 'r', encoding='utf-8') as f:
            first_line = f.readline().strip()
            if first_line.startswith('Archive fetched: '):
                return first_line.replace('Archive fetched: ', '')
    except Exception:
        pass
    return 'Unknown'

def read_xml_file(file_path):
    """Read the XML file and return its content."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return content
    except Exception as e:
        print(f"Error reading file: {e}")
        return None

def count_tokens_tiktoken(text):
    """Count tokens using tiktoken (OpenAI GPT-4)."""
    try:
        encoding = tiktoken.encoding_for_model("gpt-4")
        tokens = encoding.encode(text)
        return len(tokens)
    except Exception as e:
        print(f"Error with tiktoken: {e}")
        return None


def format_number(num):
    """Format number with commas."""
    return f"{num:,}"

def format_bytes(bytes_count: int) -> str:
    """
    Format byte count in human-readable format.
    
    Args:
        bytes_count: Number of bytes
        
    Returns:
        Formatted string with appropriate unit
    """
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_count < 1024.0:
            return f"{bytes_count:.1f} {unit}"
        bytes_count /= 1024.0
    return f"{bytes_count:.1f} TB"

def generate_report(file_size, char_count, tiktoken_count, tiktoken_time, 
                   filtered_file_size, filtered_char_count, filtered_tiktoken_count):
    """Generate markdown report from token analysis results."""
    
    # Generate report content
    report_content = f"""# Token Analysis

Analysis of token counts for the Googology Wiki MediaWiki XML export using tiktoken (OpenAI GPT-4).

## Summary

- **File**: `data/googology_pages_current.xml`
- **Tokenizer**: OpenAI GPT-4 (tiktoken)

## File Size Results

| Metric | Value |
|--------|-------|
| **File size** | {format_bytes(file_size)} |
| **File size after exclude** | {format_bytes(filtered_file_size)} |

- **Excluded content size**: {format_bytes(file_size - filtered_file_size)}

## Character Count Results

| Metric | Value |
|--------|-------|
| **Character count** | {format_number(char_count)} |
| **Character count after exclude** | {format_number(filtered_char_count)} |

- **Excluded character count**: {format_number(char_count - filtered_char_count)}

## Token Count Results

| Metric | Value |
|--------|-------|
| **Tokens** | {format_number(tiktoken_count)} |
| **Tokens (after exclude)** | {format_number(filtered_tiktoken_count)} |

- **Chars/Token**: {char_count / tiktoken_count:.2f}
- **Processing Time**: {tiktoken_time:.3f}s

"""
    
    # Add license section
    report_content += f"""
---

## License and Attribution

This analysis contains content from the **Googology Wiki** (googology.fandom.com), which is licensed under the [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://creativecommons.org/licenses/by-sa/3.0/).

- **Original Source**: [Googology Wiki](https://googology.fandom.com)
- **License**: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- **Attribution**: Content creators and contributors of the Googology Wiki
- **Modifications**: This analysis extracts and reorganizes data from the original wiki content

*Archive fetched: {get_fetch_date()}*  
*Generated by tokens.py*  
*Analysis date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
    
    return report_content

def main():
    """Main function to run the token analysis."""
    print("Token Counter for Googology Wiki MediaWiki XML")
    print("=" * 50)
    
    # Check if XML file exists
    if not os.path.exists(XML_FILE):
        print(f"Error: XML file not found at {XML_FILE}")
        print("Please run the fetch tool first to download the data.")
        return
    
    # Read XML file
    print(f"Reading file: {XML_FILE}")
    content = read_xml_file(XML_FILE)
    
    if not content:
        print("Failed to read XML file")
        return
    
    # File info
    file_size = len(content.encode('utf-8'))
    char_count = len(content)
    
    print(f"File size: {format_number(file_size)} bytes")
    print(f"Character count: {format_number(char_count)} characters")
    print()
    
    # Load exclusions and filter content
    print("Loading exclusions...")
    excluded_namespaces = load_excluded_namespaces(EXCLUDE_FILE)
    print(f"Found {len(excluded_namespaces)} excluded namespaces")
    
    filtered_content = filter_excluded_content(content, excluded_namespaces)
    filtered_file_size = len(filtered_content.encode('utf-8'))
    filtered_char_count = len(filtered_content)
    
    print(f"Filtered file size: {format_number(filtered_file_size)} bytes")
    print(f"Filtered character count: {format_number(filtered_char_count)} characters")
    print()
    
    # Count tokens using tiktoken
    print("Counting tokens (original content)...")
    
    print("tiktoken (OpenAI GPT-4)...")
    start_time = time.time()
    tiktoken_count = count_tokens_tiktoken(content)
    tiktoken_time = time.time() - start_time
    
    # Count tokens for filtered content
    print("Counting tokens (filtered content)...")
    
    print("tiktoken (GPT-4) - filtered...")
    filtered_tiktoken_count = count_tokens_tiktoken(filtered_content)
    
    # Generate report
    report_content = generate_report(
        file_size, char_count, tiktoken_count, tiktoken_time,
        filtered_file_size, filtered_char_count, filtered_tiktoken_count
    )
    
    # Write report to file
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    print(f"Report generated: {OUTPUT_FILE}")
    
    # Display console results
    print("\n" + "=" * 50)
    print("RESULTS")
    print("=" * 50)
    
    if tiktoken_count:
        chars_per_token = char_count / tiktoken_count
        print(f"Tokens: {format_number(tiktoken_count)}")
        print(f"Tokens (after exclude): {format_number(filtered_tiktoken_count)}")
        print(f"Processing time: {tiktoken_time:.3f}s")
        print(f"Characters per token: {chars_per_token:.2f}")
        
        # Calculate reduction percentage
        reduction_percent = (tiktoken_count - filtered_tiktoken_count) / tiktoken_count * 100
        print(f"Token reduction: {reduction_percent:.1f}%")
    
    print(f"\nAnalysis complete! Report saved to: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()