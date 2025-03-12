describe('Issue Number Detection Tests', () => {
  /**
   * A simplified version of the extractIssueNumbers method from AgentOrchestrator
   * that we can directly test without dependencies
   */
  function extractIssueNumbers(text: string): number[] {
    const issueRegex = /\bissue\s*#?(\d+)\b|\b#(\d+)\b/gi;
    const matches = Array.from(text.matchAll(issueRegex));
    
    return matches
      .map(match => parseInt(match[1] || match[2], 10))
      .filter(num => !isNaN(num));
  }

  test('should extract issue numbers with # prefix', () => {
    const text = 'Please implement #42 and #123';
    const result = extractIssueNumbers(text);
    expect(result).toEqual([42, 123]);
  });

  test('should extract issue numbers with "issue" prefix', () => {
    const text = 'Please implement issue 42 and issue #123';
    const result = extractIssueNumbers(text);
    expect(result).toEqual([42, 123]);
  });

  test('should handle mixed formats', () => {
    const text = 'Please implement issue 42, #123, and issue #456';
    const result = extractIssueNumbers(text);
    expect(result).toEqual([42, 123, 456]);
  });

  test('should return empty array if no issue numbers found', () => {
    const text = 'Please implement this feature';
    const result = extractIssueNumbers(text);
    expect(result).toEqual([]);
  });

  test('should handle case insensitivity', () => {
    const text = 'Please implement Issue 42 and ISSUE #123';
    const result = extractIssueNumbers(text);
    expect(result).toEqual([42, 123]);
  });

  test('should not extract numbers that are not issue numbers', () => {
    const text = 'Add 42 items and set timeout to 123 seconds';
    const result = extractIssueNumbers(text);
    expect(result).toEqual([]);
  });

  test('should identify issue number at end of sentence', () => {
    const text = 'Let\'s work on issue #42.';
    const result = extractIssueNumbers(text);
    expect(result).toEqual([42]);
  });

  test('should identify issue numbers with other punctuation', () => {
    const text = 'Issues: #42, #123; also issue 456!';
    const result = extractIssueNumbers(text);
    expect(result).toEqual([42, 123, 456]);
  });
}); 