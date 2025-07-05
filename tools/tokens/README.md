# Token Analysis Tool

This tool analyzes token counts for the Googology Wiki statistics HTML file using different tokenization methods.

## Overview

The token analysis tool compares how different tokenization methods count tokens in the `data/statistics-googology-wiki-fandom.html` file. This is useful for understanding how different Large Language Models (LLMs) would process the content and for estimating API costs.

## Features

- **Multiple tokenization methods**: Compares tiktoken (OpenAI GPT-4), transformers (BERT), and generic estimation
- **Performance analysis**: Measures processing time for each method
- **Detailed comparison**: Shows percentage differences between methods
- **Usage recommendations**: Provides guidance on when to use each method

## Usage

### Prerequisites

Install required Python packages:

```bash
pip install tiktoken transformers
```

### Running the Analysis

```bash
cd tools/tokens
python3 tokens.py
```

### Input

- `data/statistics-googology-wiki-fandom.html` - Googology Wiki statistics page (HTML format)

### Output

- `tokens.md` - Markdown report with tokenization analysis results
- Console output with comparison table

## Methods Compared

### 1. tiktoken (OpenAI GPT-4)
- **Purpose**: Most accurate for OpenAI models (ChatGPT, GPT-4)
- **Use case**: API cost estimation, prompt planning
- **Tokenizer**: OpenAI's official tokenizer

### 2. transformers (BERT)
- **Purpose**: General NLP tasks with Hugging Face models
- **Use case**: Working with BERT and other transformer models
- **Tokenizer**: Hugging Face BERT tokenizer

### 3. Generic Estimation
- **Purpose**: Quick approximation
- **Use case**: Fast estimates when exact counts aren't critical
- **Method**: Character count ÷ 3

## Sample Output

The tool generates both console output and a markdown report:

```
Method               Tokens       Time (s)   Chars/Token 
-------------------------------------------------------
tiktoken (GPT-4)     91,605       0.102s     2.48
transformers (BERT)  109,445      1.287s     2.08
Generic estimation   75,778       0.000s     3.00
```

## Analysis Results

The markdown report includes:
- File statistics (size, character count)
- Token count comparison table
- Performance differences between methods
- Usage recommendations
- Method accuracy analysis

## Dependencies

- Python 3.x
- tiktoken
- transformers
- Standard library modules (os, time, datetime)

## Notes

- The transformers library may show warnings about missing PyTorch/TensorFlow - these can be ignored for tokenization-only tasks
- BERT tokenizer has a 512 token limit warning, but this doesn't affect the counting accuracy
- Different tokenizers handle HTML content, special characters, and technical terms differently

## Integration

This tool is integrated into:
- `tools/dothemall.bash` - Automated execution
- `tools/README.md` - Documentation
- GitHub Actions workflows - CI/CD pipeline