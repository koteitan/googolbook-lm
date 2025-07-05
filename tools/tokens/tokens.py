#!/usr/bin/env python3
"""
Token Counter for Googology Wiki Statistics HTML

This script analyzes the Googology Wiki statistics HTML file to count tokens
using different tokenization methods and compares the results.
"""

import tiktoken
from transformers import AutoTokenizer
import os
import time
import re
from datetime import datetime
from typing import List

# Configuration
HTML_FILE = '../../data/statistics-googology-wiki-fandom.html'
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
    This removes table rows and sections that reference excluded namespace pages.
    
    Args:
        content: HTML content to filter
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

def read_html_file(file_path):
    """Read the HTML file and return its content."""
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

def count_tokens_transformers(text):
    """Count tokens using transformers (BERT tokenizer)."""
    try:
        tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")
        tokens = tokenizer.encode(text, add_special_tokens=True)
        return len(tokens)
    except Exception as e:
        print(f"Error with transformers: {e}")
        return None

def count_tokens_generic(text):
    """Generic token estimation (approximate)."""
    # For mixed language content (English/Japanese), use conservative estimate
    # English: ~4 chars per token, Japanese: ~1-2 chars per token
    # Use 3 as a middle ground
    return len(text) // 3

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
                   transformers_count, transformers_time, generic_count, generic_time,
                   filtered_file_size, filtered_char_count, filtered_tiktoken_count, 
                   filtered_transformers_count, filtered_generic_count):
    """Generate markdown report from token analysis results."""
    
    # Generate report content
    report_content = f"""# Token Analysis

Analysis of token counts for the Googology Wiki statistics HTML file using different tokenization methods.

## Summary

- **File**: `data/statistics-googology-wiki-fandom.html`
- **File size**: {format_bytes(file_size)}
- **Character count**: {format_number(char_count)}
- **Excluded content size**: {format_bytes(file_size - filtered_file_size)}
- **Excluded character count**: {format_number(char_count - filtered_char_count)}
- **File size after exclude**: {format_bytes(filtered_file_size)}
- **Character count after exclude**: {format_number(filtered_char_count)}
- **Analysis methods**: 3 different tokenization approaches

## Token Count Results

| Method | Tokens | Tokens (after exclude) | Processing Time | Chars/Token | Description |
|--------|--------|----------------------|----------------|-------------|-------------|
"""
    
    # Add tiktoken results
    if tiktoken_count:
        chars_per_token = char_count / tiktoken_count
        report_content += f"| tiktoken (GPT-4) | {format_number(tiktoken_count)} | {format_number(filtered_tiktoken_count)} | {tiktoken_time:.3f}s | {chars_per_token:.2f} | OpenAI GPT-4 tokenizer |\n"
    
    # Add transformers results
    if transformers_count:
        chars_per_token = char_count / transformers_count
        report_content += f"| transformers (BERT) | {format_number(transformers_count)} | {format_number(filtered_transformers_count)} | {transformers_time:.3f}s | {chars_per_token:.2f} | Hugging Face BERT tokenizer |\n"
    
    # Add generic results
    if generic_count:
        chars_per_token = char_count / generic_count
        report_content += f"| Generic estimation | {format_number(generic_count)} | {format_number(filtered_generic_count)} | {generic_time:.3f}s | {chars_per_token:.2f} | Character count / 3 |\n"
    
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
    print("Token Counter for Googology Wiki Statistics HTML")
    print("=" * 50)
    
    # Check if HTML file exists
    if not os.path.exists(HTML_FILE):
        print(f"Error: HTML file not found at {HTML_FILE}")
        print("Please run the fetch tool first to download the data.")
        return
    
    # Read HTML file
    print(f"Reading file: {HTML_FILE}")
    content = read_html_file(HTML_FILE)
    
    if not content:
        print("Failed to read HTML file")
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
    
    # Count tokens using different methods
    print("Counting tokens (original content)...")
    
    # 1. tiktoken (OpenAI GPT-4)
    print("1. tiktoken (OpenAI GPT-4)...")
    start_time = time.time()
    tiktoken_count = count_tokens_tiktoken(content)
    tiktoken_time = time.time() - start_time
    
    # 2. transformers (BERT)
    print("2. transformers (BERT)...")
    start_time = time.time()
    transformers_count = count_tokens_transformers(content)
    transformers_time = time.time() - start_time
    
    # 3. Generic estimation
    print("3. Generic estimation...")
    start_time = time.time()
    generic_count = count_tokens_generic(content)
    generic_time = time.time() - start_time
    
    # Count tokens for filtered content
    print("Counting tokens (filtered content)...")
    
    print("1. tiktoken (GPT-4) - filtered...")
    filtered_tiktoken_count = count_tokens_tiktoken(filtered_content)
    
    print("2. transformers (BERT) - filtered...")
    filtered_transformers_count = count_tokens_transformers(filtered_content)
    
    print("3. Generic estimation - filtered...")
    filtered_generic_count = count_tokens_generic(filtered_content)
    
    # Generate report
    report_content = generate_report(
        file_size, char_count, tiktoken_count, tiktoken_time,
        transformers_count, transformers_time, generic_count, generic_time,
        filtered_file_size, filtered_char_count, filtered_tiktoken_count,
        filtered_transformers_count, filtered_generic_count
    )
    
    # Write report to file
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    print(f"Report generated: {OUTPUT_FILE}")
    
    # Display console results
    print("\n" + "=" * 70)
    print("RESULTS COMPARISON")
    print("=" * 70)
    
    print(f"{'Method':<20} {'Tokens':<12} {'After Exclude':<14} {'Time (s)':<10} {'Chars/Token':<12}")
    print("-" * 70)
    
    if tiktoken_count:
        chars_per_token = char_count / tiktoken_count
        print(f"{'tiktoken (GPT-4)':<20} {format_number(tiktoken_count):<12} {format_number(filtered_tiktoken_count):<14} {tiktoken_time:.3f}s{'':<4} {chars_per_token:.2f}")
    
    if transformers_count:
        chars_per_token = char_count / transformers_count
        print(f"{'transformers (BERT)':<20} {format_number(transformers_count):<12} {format_number(filtered_transformers_count):<14} {transformers_time:.3f}s{'':<4} {chars_per_token:.2f}")
    
    if generic_count:
        chars_per_token = char_count / generic_count
        print(f"{'Generic estimation':<20} {format_number(generic_count):<12} {format_number(filtered_generic_count):<14} {generic_time:.3f}s{'':<4} {chars_per_token:.2f}")
    
    print(f"\nAnalysis complete! Report saved to: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()