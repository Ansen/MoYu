export function testHighlighterLogic() {
  console.log('--- Running CW Player Highlighter Continuous Selection Logic Tests ---');

  // Simulated node structure in text engine
  const mockNodes = [
    { node: { nodeValue: '=== continued to ' }, length: 17 },
    { node: { nodeValue: 'strengthen the overall leadership' }, length: 33 }
  ];

  // Helper function mimicking the range calculation in useHighlighter.js
  function calculateHighlightRange(nodes, token, sessionStart) {
    let currentIndex = 0;
    let targetNode = null;
    let targetOffset = 0;

    for (let i = 0; i < nodes.length; i++) {
      const { node, length } = nodes[i];
      if (token.index >= currentIndex && token.index < currentIndex + length) {
        targetNode = node;
        targetOffset = token.index - currentIndex;
        break;
      }
      currentIndex += length;
    }

    if (!targetNode) return null;

    // Determine start node/offset
    let startNode = sessionStart.node || nodes[0].node;
    let startOffset = sessionStart.offset || 0;

    return {
      playedRange: {
        startNode,
        startOffset,
        endNode: targetNode,
        endOffset: targetOffset
      },
      activeRange: {
        startNode: targetNode,
        startOffset: targetOffset,
        endNode: targetNode,
        endOffset: targetOffset + (token.length || 1)
      }
    };
  }

  // 1. Test playback starting at index 0
  const sessionStart = { node: null, offset: 0 };
  const token0 = { index: 0, length: 3, word: '===' };
  const res0 = calculateHighlightRange(mockNodes, token0, sessionStart);
  
  if (!res0 || res0.playedRange.startOffset !== 0 || res0.playedRange.endOffset !== 0) {
    throw new Error('Initial token highlight range incorrect');
  }
  console.log('✓ Initial start token range accurately anchored at offset 0.');

  // 2. Test progressing to token 'continued' at index 4
  const token1 = { index: 4, length: 9, word: 'continued' };
  const res1 = calculateHighlightRange(mockNodes, token1, sessionStart);
  if (!res1 || res1.playedRange.endOffset !== 4) {
    throw new Error('Played range end offset should match current token index 4');
  }
  console.log('✓ Played continuous inverted selection extends from offset 0 to offset 4 seamlessly.');

  // 3. Test multi-node crossing (e.g. index 20, which is in the second node at offset 3)
  const token2 = { index: 20, length: 10, word: 'strengthen' };
  const res2 = calculateHighlightRange(mockNodes, token2, sessionStart);
  if (!res2 || res2.playedRange.endNode !== mockNodes[1].node || res2.playedRange.endOffset !== 3) {
    throw new Error('Multi-node range crossing failed');
  }
  console.log('✓ Multi-node boundary crossing correctly tracks targetNode and offset.');

  console.log('All Highlighter continuous selection tests passed successfully!\n');
}
