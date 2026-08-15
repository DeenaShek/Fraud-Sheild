import { FRAUD_POLICIES } from './knowledgeBase.js';

/**
 * FraudShield RAG Retriever
 * 
 * Performs keyword & semantic relevance ranking across approved bank fraud policies,
 * SOP guidelines, and historical precedents.
 */
export class PolicyRetriever {
  constructor(policies = FRAUD_POLICIES) {
    this.policies = policies;
  }

  /**
   * Tokenizes text into lowercase normalized words, removing common stop words.
   */
  tokenize(text) {
    if (!text) return [];
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with',
      'as', 'by', 'that', 'this', 'it', 'from', 'or', 'be', 'are', 'was', 'were', 'what',
      'why', 'how', 'when', 'who', 'should', 'can', 'does', 'if', 'into', 'out'
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1 && !stopWords.has(token));
  }

  /**
   * Calculates similarity score between query tokens and policy document.
   */
  scoreDocument(queryTokens, policy) {
    let score = 0;
    const docTokens = new Set([
      ...this.tokenize(policy.title),
      ...this.tokenize(policy.category),
      ...this.tokenize(policy.content),
      ...(policy.keywords || []).map(k => k.toLowerCase())
    ]);

    const titleTokens = new Set(this.tokenize(policy.title));
    const keywordTokens = new Set((policy.keywords || []).map(k => k.toLowerCase()));

    for (const token of queryTokens) {
      if (titleTokens.has(token)) {
        score += 4.5; // High weight for title matches
      } else if (keywordTokens.has(token)) {
        score += 3.5; // High weight for curated keyword matches
      } else if (docTokens.has(token)) {
        score += 1.0;
      }
    }

    return score;
  }

  /**
   * Retrieves top-K most relevant policies for an investigator query or transaction context.
   * 
   * @param {string} query - Investigator question or topic
   * @param {number} topK - Number of top documents to return
   * @param {Object} filter - Optional category filter
   * @returns {Array} List of matching policies with relevance scores and excerpts
   */
  retrieveRelevantPolicies(query, topK = 3, filter = {}) {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) {
      return this.policies.slice(0, topK).map(p => ({
        ...p,
        relevanceScore: 1.0,
        matchedExcerpt: p.content.trim().slice(0, 200) + '...'
      }));
    }

    const scored = this.policies
      .filter(p => !filter.category || p.category === filter.category)
      .map(policy => {
        const score = this.scoreDocument(queryTokens, policy);
        return {
          id: policy.id,
          title: policy.title,
          category: policy.category,
          effectiveDate: policy.effectiveDate,
          relevanceScore: Number(score.toFixed(2)),
          fullContent: policy.content.trim(),
          matchedExcerpt: this.extractExcerpt(policy.content, queryTokens),
          keywords: policy.keywords
        };
      })
      .filter(res => res.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    // If no direct matches, return general risk thresholds policy
    if (scored.length === 0) {
      const fallback = this.policies[0];
      return [{
        id: fallback.id,
        title: fallback.title,
        category: fallback.category,
        relevanceScore: 0.5,
        fullContent: fallback.content.trim(),
        matchedExcerpt: fallback.content.trim().slice(0, 200) + '...',
        keywords: fallback.keywords
      }];
    }

    return scored.slice(0, topK);
  }

  /**
   * Extracts a short contextual excerpt highlighting the search terms.
   */
  extractExcerpt(content, queryTokens) {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const lineLower = line.toLowerCase();
      if (queryTokens.some(t => lineLower.includes(t))) {
        return line.length > 250 ? line.slice(0, 250) + '...' : line;
      }
    }
    return lines[0] ? (lines[0].slice(0, 200) + '...') : '';
  }

  /**
   * Retrieves relevant policies based on active triggered rules for a transaction.
   */
  retrieveForTriggeredRules(triggeredRules = []) {
    const categories = triggeredRules.map(r => r.category || r.ruleId).join(' ');
    return this.retrieveRelevantPolicies(`policy for ${categories} fraud investigation`, 3);
  }
}

export const policyRetriever = new PolicyRetriever();
