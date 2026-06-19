export interface LineDifference { line: number; expected: string; actual: string }

export function lineDifferences(expected: string, actual: string, limit = 12): LineDifference[] {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const differences: LineDifference[] = [];
  const count = Math.max(expectedLines.length, actualLines.length);
  for (let index = 0; index < count && differences.length < limit; index += 1) {
    if (expectedLines[index] !== actualLines[index]) {
      differences.push({
        line: index + 1,
        expected: expectedLines[index] ?? '<missing>',
        actual: actualLines[index] ?? '<missing>',
      });
    }
  }
  return differences;
}
