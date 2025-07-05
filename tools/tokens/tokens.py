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
from datetime import datetime

# Configuration
HTML_FILE = '../../data/statistics-googology-wiki-fandom.html'
OUTPUT_FILE = 'tokens.md'
FETCH_LOG_FILE = '../../data/fetch_log.txt'

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
                   transformers_count, transformers_time, generic_count, generic_time):
    """Generate markdown report from token analysis results."""
    
    # Generate report content
    report_content = f"""# Token Analysis

Analysis of token counts for the Googology Wiki statistics HTML file using different tokenization methods.

## Summary

- **File**: `data/statistics-googology-wiki-fandom.html`
- **File size**: {format_bytes(file_size)}
- **Character count**: {format_number(char_count)}
- **Analysis methods**: 3 different tokenization approaches

## Token Count Results

| Method | Tokens | Processing Time | Chars/Token | Description |
|--------|--------|----------------|-------------|-------------|
"""
    
    # Add tiktoken results
    if tiktoken_count:
        chars_per_token = char_count / tiktoken_count
        report_content += f"| tiktoken (GPT-4) | {format_number(tiktoken_count)} | {tiktoken_time:.3f}s | {chars_per_token:.2f} | OpenAI GPT-4 tokenizer |\n"
    
    # Add transformers results
    if transformers_count:
        chars_per_token = char_count / transformers_count
        report_content += f"| transformers (BERT) | {format_number(transformers_count)} | {transformers_time:.3f}s | {chars_per_token:.2f} | Hugging Face BERT tokenizer |\n"
    
    # Add generic results
    if generic_count:
        chars_per_token = char_count / generic_count
        report_content += f"| Generic estimation | {format_number(generic_count)} | {generic_time:.3f}s | {chars_per_token:.2f} | Character count / 3 |\n"
    
    # Add comparison analysis
    report_content += f"""
## Method Comparison

### Accuracy and Use Cases
- **tiktoken (GPT-4)**: Most accurate for OpenAI models, recommended for ChatGPT/GPT-4 API usage estimation
- **transformers (BERT)**: Good for general NLP tasks, may differ from GPT models due to different vocabulary
- **Generic estimation**: Fastest approximation, useful for quick estimates

### Performance Differences
"""
    
    # Add percentage differences
    if tiktoken_count and transformers_count:
        diff_percent = abs(tiktoken_count - transformers_count) / tiktoken_count * 100
        report_content += f"- **tiktoken vs transformers**: {diff_percent:.1f}% difference\n"
    
    if tiktoken_count and generic_count:
        diff_percent = abs(tiktoken_count - generic_count) / tiktoken_count * 100
        report_content += f"- **tiktoken vs generic**: {diff_percent:.1f}% difference\n"
    
    if transformers_count and generic_count:
        diff_percent = abs(transformers_count - generic_count) / transformers_count * 100
        report_content += f"- **transformers vs generic**: {diff_percent:.1f}% difference\n"
    
    # Add analysis summary
    report_content += f"""
## Analysis Summary

### Token Count Characteristics
The HTML file contains a mix of structured content (HTML tags, CSS, JavaScript) and text content (statistics, descriptions). Different tokenizers handle this mixed content differently:

- **Structured content**: HTML tags and attributes are tokenized differently by each method
- **Numeric data**: Statistics and numbers have varying tokenization patterns
- **Mixed language**: English text with some technical terms affects token boundaries

### Recommendations
- Use **tiktoken** for OpenAI API cost estimation and prompt planning
- Use **transformers** tokenizers when working with specific Hugging Face models
- Use **generic estimation** for quick approximations when exact counts aren't critical

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
    
    # Count tokens using different methods
    print("Counting tokens...")
    
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
    
    # Generate report
    report_content = generate_report(
        file_size, char_count, tiktoken_count, tiktoken_time,
        transformers_count, transformers_time, generic_count, generic_time
    )
    
    # Write report to file
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    print(f"Report generated: {OUTPUT_FILE}")
    
    # Display console results
    print("\n" + "=" * 50)
    print("RESULTS COMPARISON")
    print("=" * 50)
    
    print(f"{'Method':<20} {'Tokens':<12} {'Time (s)':<10} {'Chars/Token':<12}")
    print("-" * 55)
    
    if tiktoken_count:
        chars_per_token = char_count / tiktoken_count
        print(f"{'tiktoken (GPT-4)':<20} {format_number(tiktoken_count):<12} {tiktoken_time:.3f}s{'':<4} {chars_per_token:.2f}")
    
    if transformers_count:
        chars_per_token = char_count / transformers_count
        print(f"{'transformers (BERT)':<20} {format_number(transformers_count):<12} {transformers_time:.3f}s{'':<4} {chars_per_token:.2f}")
    
    if generic_count:
        chars_per_token = char_count / generic_count
        print(f"{'Generic estimation':<20} {format_number(generic_count):<12} {generic_time:.3f}s{'':<4} {chars_per_token:.2f}")
    
    print(f"\nAnalysis complete! Report saved to: {OUTPUT_FILE}")

if __name__ == '__main__':
    main()