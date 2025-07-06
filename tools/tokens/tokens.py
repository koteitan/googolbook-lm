#!/usr/bin/env python3
"""
Token Counter for Googology Wiki MediaWiki XML

This script analyzes the Googology Wiki MediaWiki XML export to count tokens
using different tokenization methods and compares the results.
"""

import tiktoken
import os
import time
from datetime import datetime
from typing import List, Tuple

# Import shared library modules
import sys
sys.path.append('../../')
import config
from lib.exclusions import load_excluded_namespaces, should_exclude_page
from lib.xml_parser import parse_namespaces, get_namespace_name, extract_page_elements, iterate_pages
from lib.formatting import format_number, format_bytes
from lib.io_utils import get_fetch_date, check_xml_exists
from lib.reporting import generate_license_footer, write_markdown_report

# Local configuration
OUTPUT_FILE = 'tokens.md'

# Removed - now imported from lib.exclusions

# Removed - now imported from lib.xml_parser

# Removed - now imported from lib.xml_parser

# Removed - now imported from lib.exclusions

def filter_and_analyze_xml(xml_file_path: str, excluded_namespaces: List[str]) -> Tuple[str, int, str, int]:
    """
    Filter XML content by excluding pages from specified namespaces.
    
    Returns:
        Tuple of (original_content, original_page_count, filtered_content, filtered_page_count)
    """
    print("Parsing XML and filtering content...")
    
    # Parse namespace definitions
    namespace_map = parse_namespaces(xml_file_path)
    
    original_pages = []
    filtered_pages = []
    
    # Build XML header
    xml_header = """<?xml version="1.0" encoding="UTF-8"?>
<mediawiki xmlns="http://www.mediawiki.org/xml/export-0.11/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.mediawiki.org/xml/export-0.11/ http://www.mediawiki.org/xml/export-0.11.xsd" version="0.11" xml:lang="en">
"""
    
    # Process pages using shared iterator
    filtered_page_count = 0
    
    for page_count, elements in iterate_pages(xml_file_path):
        if elements['title'] and elements['ns']:
            # Get namespace name
            namespace_name = get_namespace_name(elements['ns'], elements['title'], namespace_map)
            
            # Store original page content (simplified - would need full page XML)
            # For now, just use the text content for token counting
            page_text = elements['text'] or ''
            original_pages.append(page_text)
            
            # Check if page should be excluded
            if not should_exclude_page(elements['title'], excluded_namespaces) and namespace_name not in excluded_namespaces:
                filtered_pages.append(page_text)
                filtered_page_count += 1
    
    # Build complete content (simplified for token counting)
    original_content = "\n".join(original_pages)
    filtered_content = "\n".join(filtered_pages)
    
    print(f"Total pages: {page_count}")
    print(f"Filtered pages: {filtered_page_count}")
    print(f"Excluded pages: {page_count - filtered_page_count}")
    
    return original_content, page_count, filtered_content, filtered_page_count

# Removed - now imported from lib.io_utils


def count_tokens_tiktoken(text):
    """Count tokens using tiktoken (OpenAI GPT-4)."""
    try:
        encoding = tiktoken.encoding_for_model("gpt-4")
        tokens = encoding.encode(text)
        return len(tokens)
    except Exception as e:
        print(f"Error with tiktoken: {e}")
        return None


# Removed - now imported from lib.formatting

def generate_report(file_size, char_count, page_count, tiktoken_count, tiktoken_time, 
                   filtered_file_size, filtered_char_count, filtered_page_count, filtered_tiktoken_count):
    """Generate markdown report from token analysis results."""
    
    # Generate report content
    report_content = f"""# Token Analysis

Analysis of token counts for the Googology Wiki MediaWiki XML export using tiktoken (OpenAI GPT-4).

## Summary

- **File**: `data/googology_pages_current.xml`
- **Tokenizer**: OpenAI GPT-4 (tiktoken)

## Page Count Results

| Metric | Value |
|--------|-------|
| **Pages** | {format_number(page_count)} |
| **Pages (after exclude)** | {format_number(filtered_page_count)} |
| **Filtered rate** | {(filtered_page_count / page_count * 100):.1f}% |

- **Excluded pages**: {format_number(page_count - filtered_page_count)}

## File Size Results

| Metric | Value |
|--------|-------|
| **File size** | {format_bytes(file_size)} |
| **File size after exclude** | {format_bytes(filtered_file_size)} |
| **Filtered rate** | {(filtered_file_size / file_size * 100):.1f}% |

- **Excluded content size**: {format_bytes(file_size - filtered_file_size)}

## Character Count Results

| Metric | Value |
|--------|-------|
| **Character count** | {format_number(char_count)} |
| **Character count after exclude** | {format_number(filtered_char_count)} |
| **Filtered rate** | {(filtered_char_count / char_count * 100):.1f}% |

- **Excluded character count**: {format_number(char_count - filtered_char_count)}

## Token Count Results

| Metric | Value |
|--------|-------|
| **Tokens** | {format_number(tiktoken_count)} |
| **Tokens (after exclude)** | {format_number(filtered_tiktoken_count)} |
| **Filtered rate** | {(filtered_tiktoken_count / tiktoken_count * 100):.1f}% |

- **Chars/Token**: {char_count / tiktoken_count:.2f}
- **Processing Time**: {tiktoken_time:.3f}s

"""
    
    # Add license section
    report_content += generate_license_footer('tokens.py')
    
    return report_content

def main():
    """Main function to run the token analysis."""
    print("Token Counter for Googology Wiki MediaWiki XML")
    print("=" * 50)
    
    # Check if XML file exists
    if not check_xml_exists():
        return
    
    # Load exclusions and filter content
    print("Loading exclusions...")
    excluded_namespaces = load_excluded_namespaces()
    print(f"Found {len(excluded_namespaces)} excluded namespaces")
    
    # Filter XML content properly by excluding entire pages
    content, page_count, filtered_content, filtered_page_count = filter_and_analyze_xml(config.XML_FILE, excluded_namespaces)
    
    # File info
    file_size = len(content.encode('utf-8'))
    char_count = len(content)
    filtered_file_size = len(filtered_content.encode('utf-8'))
    filtered_char_count = len(filtered_content)
    
    print(f"File size: {format_number(file_size)} bytes")
    print(f"Character count: {format_number(char_count)} characters")
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
        file_size, char_count, page_count, tiktoken_count, tiktoken_time,
        filtered_file_size, filtered_char_count, filtered_page_count, filtered_tiktoken_count
    )
    
    # Write report to file
    write_markdown_report(OUTPUT_FILE, report_content)
    
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