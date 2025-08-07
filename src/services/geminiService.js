const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/config');
const logger = require('../utils/logger');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: config.GEMINI_MODEL });
  }

  /**
   * Generate code review comments for a pull request
   * @param {Object} prData - Pull request data containing files and diffs
   * @returns {Promise<Array>} Array of review comments
   */
  async generateReview(prData) {
    const maxRetries = 5; // Increased from 3 to 5
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info('Starting code review generation', { 
          prId: prData.pull_request_id,
          filesCount: prData.diff_files?.length || 0,
          attempt
        });

        const prompt = this.buildReviewPrompt(prData);
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const reviewText = response.text();

        logger.debug('Raw Gemini response', { response: reviewText });

        const parsedReview = this.parseReviewResponse(reviewText);
        
        logger.info('Code review generated successfully', {
          prId: prData.pull_request_id,
          commentsCount: parsedReview.length,
          attempt
        });

        return parsedReview;
      } catch (error) {
        lastError = error;
        
        // Check if it's a 503 Service Unavailable error
        if (error.message.includes('503') || error.message.includes('overloaded')) {
          const baseWaitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          const jitter = Math.random() * 1000; // Add 0-1s random jitter
          const waitTime = baseWaitTime + jitter;
          
          logger.warn('Gemini API overloaded, retrying...', {
            error: error.message,
            prId: prData.pull_request_id,
            attempt,
            maxRetries,
            waitTimeMs: Math.round(waitTime)
          });

          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }

        // For non-503 errors or final attempt, throw immediately
        logger.error('Error generating code review', {
          error: error.message,
          prId: prData.pull_request_id,
          attempt,
          stack: error.stack
        });
        break;
      }
    }

    throw new Error(`Failed to generate code review after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Build the prompt for Gemini AI
   * @param {Object} prData - Pull request data
   * @returns {string} Formatted prompt
   */
  buildReviewPrompt(prData) {
    const { pull_request_id, repository, diff_files, pr_info } = prData;
    
    const criteriaChecks = [];
    if (config.REVIEW_CRITERIA.checkSecurity) criteriaChecks.push('Security vulnerabilities and potential exploits');
    if (config.REVIEW_CRITERIA.checkPerformance) criteriaChecks.push('Performance optimizations and efficiency');
    if (config.REVIEW_CRITERIA.checkReadability) criteriaChecks.push('Code readability and maintainability');
    if (config.REVIEW_CRITERIA.checkBestPractices) criteriaChecks.push('Language/framework best practices');
    if (config.REVIEW_CRITERIA.checkTesting) criteriaChecks.push('Test coverage and quality');
    if (config.REVIEW_CRITERIA.checkDocumentation) criteriaChecks.push('Documentation and comments');

    const filesContext = diff_files.map(file => `
### File: ${file.file_path}
**Status:** ${file.status || 'modified'}
**Language:** ${this.detectLanguage(file.file_path)}
**Diff:**
\`\`\`diff
${file.diff}
\`\`\`
`).join('\n');

    return `You are a Code Review Agent for GitHub Pull Requests. You are an expert software engineer with deep knowledge across multiple programming languages and frameworks.

**PULL REQUEST CONTEXT:**
- Repository: ${repository}
- PR ID: ${pull_request_id}
- Title: ${pr_info?.title || 'N/A'}
- Description: ${pr_info?.description || 'N/A'}

**REVIEW CRITERIA:**
Analyze the following pull request changes and check for:
${criteriaChecks.map(criteria => `- ${criteria}`).join('\n')}

**FILES TO REVIEW:**
${filesContext}

**INSTRUCTIONS:**
1. Carefully analyze each file's changes
2. Focus on meaningful issues that could impact code quality, security, or maintainability
3. Provide constructive, specific feedback with actionable suggestions
4. Consider the context of the entire PR, not just individual lines
5. Be concise but thorough in your explanations
6. Only flag real issues - avoid nitpicking minor style preferences unless they impact readability

**OUTPUT FORMAT:**
Respond with a valid JSON array of review comments. Each comment should have this structure:
[
  {
    "file": "relative/path/to/file.ext",
    "line": line_number,
    "severity": "error|warning|suggestion",
    "category": "security|performance|readability|best-practices|testing|documentation|bug|maintainability",
    "comment": "Clear, actionable feedback with specific suggestions for improvement",
    "suggestion": "Optional: Proposed code fix or improvement"
  }
]

If the code looks good and no issues are found, return an empty array: []

**IMPORTANT:**
- Only return valid JSON
- Do not include markdown formatting in the JSON
- Ensure line numbers are accurate to the diff context
- Focus on substantial issues, not minor formatting
- Be helpful and constructive in your tone`;
  }

  /**
   * Parse the response from Gemini AI
   * @param {string} responseText - Raw response from Gemini
   * @returns {Array} Parsed review comments
   */
 parseReviewResponse(responseText) {
  const allowedSeverities = ['error', 'warning', 'suggestion'];
  const normalizeSeverity = (severity) => allowedSeverities.includes(severity) ? severity : 'error';

  try {
    // Remove any markdown code blocks and extra formatting
    let cleanedResponse = responseText
      .replace(/```json\s*/g, '') // Remove ```json
      .replace(/```\s*/g, '') // Remove closing ```
      .replace(/```[\s\S]*?```/g, '') // Remove any other code blocks
      .trim();

    // Try to find JSON array in the response
    const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }

    // Additional cleanup - remove any trailing text after the JSON
    const jsonEndIndex = cleanedResponse.lastIndexOf(']');
    if (jsonEndIndex !== -1) {
      cleanedResponse = cleanedResponse.substring(0, jsonEndIndex + 1);
    }

    logger.debug('Cleaned JSON response', { cleanedResponse });

    const parsed = JSON.parse(cleanedResponse);

    // Validate the structure
    if (!Array.isArray(parsed)) {
      logger.warn('Gemini response is not an array, wrapping in array');
      return [];
    }

    // Validate and clean each comment
    return parsed.filter(comment => {
      if (!comment.file || !comment.comment) {
        logger.warn('Invalid comment structure, skipping', { comment });
        return false;
      }
      return true;
    }).map(comment => ({
      file: comment.file,
      line: parseInt(comment.line) || 1,
      severity: normalizeSeverity(comment.severity),
      category: comment.category || 'general',
      comment: comment.comment,
      suggestion: comment.suggestion || null
    }));

  } catch (error) {
    logger.error('Failed to parse Gemini response', {
      error: error.message,
      response: responseText.substring(0, 500) + '...' // Log first 500 chars only
    });
    
    // Try alternative parsing methods
    try {
      // Extract just the array part more aggressively
      const arrayStart = responseText.indexOf('[');
      const arrayEnd = responseText.lastIndexOf(']');
      
      if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        const jsonPart = responseText.substring(arrayStart, arrayEnd + 1);
        const parsed = JSON.parse(jsonPart);
        
        if (Array.isArray(parsed)) {
          logger.info('Successfully parsed with fallback method');
          return parsed.filter(comment => comment.file && comment.comment)
            .map(comment => ({
              file: comment.file,
              line: parseInt(comment.line) || 1,
              severity: normalizeSeverity(comment.severity),
              category: comment.category || 'general',
              comment: comment.comment,
              suggestion: comment.suggestion || null
            }));
        }
      }
    } catch (fallbackError) {
      logger.error('Fallback parsing also failed', { error: fallbackError.message });
    }
    
    return [];
  }
}


  /**
   * Detect programming language from file extension
   * @param {string} filePath - File path
   * @returns {string} Detected language
   */
  detectLanguage(filePath) {
    const extension = filePath.split('.').pop()?.toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'vue': 'vue',
      'svelte': 'svelte',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sql': 'sql'
    };
    
    return languageMap[extension] || 'unknown';
  }

  /**
   * Generate a summary review comment for the entire PR
   * @param {Array} comments - Individual file comments
   * @param {Object} prData - PR data
   * @returns {Promise<string>} Summary comment
   */
  async generateSummaryComment(comments, prData) {
    try {
      if (comments.length === 0) {
        return "🎉 **Code Review Complete**\n\nThis pull request looks good! No issues found during the automated review.";
      }

      const categoryCounts = comments.reduce((acc, comment) => {
        acc[comment.category] = (acc[comment.category] || 0) + 1;
        return acc;
      }, {});

      const severityCounts = comments.reduce((acc, comment) => {
        acc[comment.severity] = (acc[comment.severity] || 0) + 1;
        return acc;
      }, {});

      let summary = "🤖 **Automated Code Review Summary**\n\n";
      summary += `Found ${comments.length} item(s) to review:\n\n`;
      
      // Severity breakdown
      if (severityCounts.error) summary += `🔴 **${severityCounts.error} Error(s)**\n`;
      if (severityCounts.warning) summary += `🟡 **${severityCounts.warning} Warning(s)**\n`;
      if (severityCounts.suggestion) summary += `💡 **${severityCounts.suggestion} Suggestion(s)**\n`;
      
      summary += "\n**Categories:**\n";
      Object.entries(categoryCounts).forEach(([category, count]) => {
        const emoji = this.getCategoryEmoji(category);
        summary += `${emoji} ${category}: ${count}\n`;
      });

      summary += "\nPlease review the inline comments for detailed feedback.";
      
      return summary;
    } catch (error) {
      logger.error('Error generating summary comment', { error: error.message });
      return "🤖 **Automated Code Review Complete**\n\nReview completed. Please check inline comments for feedback.";
    }
  }

  /**
   * Get emoji for review category
   * @param {string} category - Review category
   * @returns {string} Emoji
   */
  getCategoryEmoji(category) {
    const emojiMap = {
      'security': '🔒',
      'performance': '⚡',
      'readability': '📖',
      'best-practices': '✨',
      'testing': '🧪',
      'documentation': '📝',
      'general': '💬'
    };
    return emojiMap[category] || '💬';
  }
}

module.exports = new GeminiService();
