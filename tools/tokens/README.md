# Token Analysis Tool

This tool analyzes token counts for the Googology Wiki MediaWiki XML export using tiktoken (OpenAI GPT-4).

## Overview

The token analysis tool counts tokens in the MediaWiki XML using OpenAI's tiktoken. This is useful for understanding how GPT models would process the content and for estimating OpenAI API costs.

## Features

- **tiktoken tokenization**: Uses OpenAI's official GPT-4 tokenizer
- **Exclusion filtering**: Supports exclude.md to filter out unwanted content sections
- **Before/after comparison**: Shows token counts before and after exclusion
- **Performance metrics**: Processing time and character-to-token ratio analysis

## Usage

### Prerequisites

Install required Python packages:

```bash
pip install tiktoken
```

### Running the Analysis

```bash
cd tools/tokens
python3 tokens.py
```

### Input

- `data/*.xml` - MediaWiki XML export

### Output

- `tokens.md` - Markdown report with tokenization analysis results
- Console output with token analysis results

## Tokenization Method

### tiktoken (OpenAI GPT-4)
- **Purpose**: Accurate token counting for OpenAI models (ChatGPT, GPT-4)
- **Use case**: API cost estimation, prompt planning, content analysis
- **Tokenizer**: OpenAI's official GPT-4 tokenizer
- **Accuracy**: Matches actual OpenAI API token consumption

## Sample Output

See [tokens.md](tokens.md) for the complete analysis report.

## Notes

- tiktoken provides accurate token counts that match OpenAI API consumption
- Processing large XML files may take several seconds depending on file size
- Exclusion filtering can significantly reduce token counts for analysis purposes
