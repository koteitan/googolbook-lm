#!/usr/bin/env python3
"""
Common prompt building functions for RAG system.
Used by both web interface (JavaScript) and Python tools.
"""

def build_system_prompt(citations):
    """
    Build the system prompt with citation requirements.
    
    Args:
        citations: List of citation dictionaries with 'number', 'title', 'url', 'type' keys
    
    Returns:
        str: The system prompt string
    """
    system_prompt = """You are a helpful assistant that answers questions about googology using the provided context from the Googology Wiki. 

Please provide detailed and informative answers based strictly on the provided context. Explain concepts clearly and include relevant definitions, examples, and background information when available in the context. Structure your response in a logical manner.

LANGUAGE REQUIREMENTS:
- Respond in the same language as the user's question
- If the user asks in Japanese, respond in Japanese
- If the user asks in English, respond in English
- If the user asks in any other language, respond in that language
- Maintain technical accuracy while using natural language appropriate to the user's language

CRITICAL CITATION REQUIREMENTS:
- You MUST cite sources for ALL factual claims and information using the provided reference numbers in square brackets (e.g., [1], [2], [3])
- Each source document in the context is numbered with [1], [2], etc. - use these exact numbers
- Place citations immediately after the relevant information: "Graham's number is extremely large [1]" not "Graham's number is extremely large. [1]"
- Use multiple citations when information comes from multiple sources: "This concept appears in several contexts [1][3][5]"
- Do NOT provide information without proper citations - if you cannot cite it, do not include it

Use the following context to answer the user's question. The context includes both title-based and content-based search results. If the context doesn't contain enough information to answer the question completely, clearly state what information is missing and provide what you can based on the available context. Do not make assumptions or add information not present in the provided context.

You can use LaTeX math notation in your responses - inline math with $...$ and display math with $$...$$ - as MathJax will render it properly.

Context from Googology Wiki:
{context}"""
    
    return system_prompt

def format_results_with_citations(title_results=None, body_results=None, citation_start=1):
    """
    Format search results with citation numbers for context.
    
    Args:
        title_results: List of title-based search results
        body_results: List of body-based search results  
        citation_start: Starting citation number (default: 1)
    
    Returns:
        tuple: (combined_context, citations_list)
    """
    citations = []
    citation_number = citation_start
    
    # Format title results
    title_context = ""
    if title_results:
        title_parts = []
        for result in title_results:
            citations.append({
                'number': citation_number,
                'title': result.get('title', 'Unknown'),
                'url': result.get('url', '#'),
                'type': 'title'
            })
            
            title_parts.append(f"[{citation_number}] **{result.get('title', 'Unknown')}**\n{result.get('content', '')}")
            citation_number += 1
        
        if title_parts:
            title_context = "Title-based relevant documents:\n" + "\n\n".join(title_parts)
    
    # Format body results
    body_context = ""
    if body_results:
        body_parts = []
        for result in body_results:
            citations.append({
                'number': citation_number,
                'title': result.get('title', 'Unknown'),
                'url': result.get('url', '#'),
                'type': 'body'
            })
            
            body_parts.append(f"[{citation_number}] **{result.get('title', 'Unknown')}**\n{result.get('content', '')}")
            citation_number += 1
        
        if body_parts:
            body_context = "Content-based relevant documents:\n" + "\n\n".join(body_parts)
    
    # Combine contexts
    combined_context = ""
    if title_context:
        combined_context += title_context
    if body_context:
        if combined_context:
            combined_context += "\n\n"
        combined_context += body_context
    
    return combined_context, citations

def create_full_prompt(query, title_results=None, body_results=None):
    """
    Create a complete prompt for LLM including system prompt and user query.
    
    Args:
        query: User's question
        title_results: List of title-based search results
        body_results: List of body-based search results
    
    Returns:
        tuple: (system_prompt, user_prompt, citations)
    """
    combined_context, citations = format_results_with_citations(title_results, body_results)
    system_prompt = build_system_prompt(citations).format(context=combined_context)
    
    return system_prompt, query, citations