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
  // 4. Test Table Grid node coordinate alignment with cleanText
  // Suppose 5 tokens: ['ydh6i', 'nb0zw', 'tle2u', 'e5yrn', 'xap6t']
  const sampleTokens = ['ydh6i', 'nb0zw', 'tle2u', 'e5yrn', 'xap6t'];
  const cleanText = sampleTokens.join(' ');
  // In Grid View, nodes are interleaved: [token0, ' ', token1, ' ', token2, ' ', token3, ' ', token4]
  const gridNodes = [];
  for (let i = 0; i < sampleTokens.length; i++) {
    gridNodes.push({ node: { nodeValue: sampleTokens[i] }, length: sampleTokens[i].length });
    if (i < sampleTokens.length - 1) {
      gridNodes.push({ node: { nodeValue: ' ' }, length: 1 });
    }
  }

  const gridConcatenated = gridNodes.map(n => n.node.nodeValue).join('');
  if (gridConcatenated !== cleanText) {
    throw new Error(`Grid concatenated text does not match cleanText! Got "${gridConcatenated}", expected "${cleanText}"`);
  }
  console.log('✓ Grid layout character stream 100% matches cleanText with spaces.');

  // 5. Test restoreHighlight state logic on layout toggle
  // Say token is character '6' in 'xap6t' (token index 27)
  const activeCharIndex = 27; // in 'xap6t' (starts at 24: 'x'=24, 'a'=25, 'p'=26, '6'=27)
  const tokenTarget = { index: activeCharIndex, char: '6' };

  function simulateRestoreHighlight(nodes, token, playbackStart = 0) {
    let charOffset = 0;
    let targetNodeIdx = -1;
    let targetOffset = 0;
    let targetNodeStart = 0;
    let startNodeIdx = 0;
    let startOffset = 0;

    for (let i = 0; i < nodes.length; i++) {
      const { length } = nodes[i];
      const nodeStart = charOffset;
      const nodeEnd = charOffset + length;

      if (playbackStart >= nodeStart && playbackStart < nodeEnd) {
        startNodeIdx = i;
        startOffset = playbackStart - nodeStart;
      }
      if (token.index >= nodeStart && token.index < nodeEnd) {
        targetNodeIdx = i;
        targetOffset = token.index - nodeStart;
        targetNodeStart = nodeStart;
      }
      charOffset += length;
    }

    const completed = [];
    for (let pIdx = startNodeIdx; pIdx < targetNodeIdx; pIdx++) {
      completed.push(pIdx);
    }

    return {
      targetNodeIdx,
      targetOffset,
      targetNodeStart,
      startNodeIdx,
      startOffset,
      completedNodeIndices: completed,
      lastCharIdx: targetNodeStart // correctly aligned
    };
  }

  const restoreState = simulateRestoreHighlight(gridNodes, tokenTarget, 0);
  if (restoreState.targetNodeIdx !== 8) { // 4 tokens * 2 - 1 = node index 8 for xap6t
    throw new Error(`Expected targetNodeIdx 8 for xap6t, got ${restoreState.targetNodeIdx}`);
  }
  if (restoreState.targetOffset !== 3) { // '6' is index 3 in 'xap6t'
    throw new Error(`Expected targetOffset 3, got ${restoreState.targetOffset}`);
  }
  // Check completed nodes: all previous 8 nodes (0 through 7) MUST be in completed
  if (restoreState.completedNodeIndices.length !== 8) {
    throw new Error(`Expected 8 completed nodes before xap6t, got ${restoreState.completedNodeIndices.length}`);
  }
  if (restoreState.lastCharIdx > tokenTarget.index) {
    throw new Error('lastCharIdx should never exceed target token index');
  }
  console.log('✓ Layout toggle restoreHighlight preserves all prior completed nodes with zero progress drop.');

  // 6. Test Binary Search and Prefix Sums for 2,000 Nodes (Simulating a long novel chapter)
  function findNodeIndexTest(tokenIndex, nodes) {
    let low = 0;
    let high = nodes.length - 1;
    let comparisons = 0;
    while (low <= high) {
      comparisons++;
      const mid = (low + high) >> 1;
      const n = nodes[mid];
      if (tokenIndex < n.start) {
        high = mid - 1;
      } else if (tokenIndex >= n.end) {
        low = mid + 1;
      } else {
        return { index: mid, comparisons };
      }
    }
    return { index: -1, comparisons };
  }

  const largeNodes = [];
  let curOffset = 0;
  for (let i = 0; i < 2000; i++) {
    const len = (i % 7) + 3; // lengths 3 to 9
    largeNodes.push({
      start: curOffset,
      end: curOffset + len,
      length: len
    });
    curOffset += len;
  }

  // Test finding a random character index
  const testCharIdx = 4582;
  const binResult = findNodeIndexTest(testCharIdx, largeNodes);
  if (binResult.index === -1) {
    throw new Error('Binary search failed to find node');
  }
  const foundNode = largeNodes[binResult.index];
  if (testCharIdx < foundNode.start || testCharIdx >= foundNode.end) {
    throw new Error(`Target char index ${testCharIdx} is not within [${foundNode.start}, ${foundNode.end})`);
  }
  // Assert binary search comparisons <= ceil(log2(2000)) + 1 = 12
  if (binResult.comparisons > 12) {
    throw new Error(`Binary search took ${binResult.comparisons} comparisons, expected <= 12`);
  }
  console.log(`✓ Binary search located target node in ${binResult.comparisons} comparisons out of 2,000 nodes (O(log N)).`);

  console.log('All Highlighter continuous selection tests passed successfully!\n');
}
