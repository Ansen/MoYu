export const PREFIX_MARKER_OPTIONS = [
  { id: '===', label: '=== (标准报头)' },
  { id: 'KA', label: 'KA (通报开始)' },
  { id: 'BT', label: 'BT (正文分隔)' },
  { id: 'HR', label: 'HR (台站通告)' },
  { id: '', label: '无 (关闭报头)' },
];

export const SUFFIX_MARKER_OPTIONS = [
  { id: 'iii +', label: 'iii + (标准报尾+结束)' },
  { id: 'iii', label: 'iii (练习结束)' },
  { id: '+', label: '+ (电文结束)' },
  { id: 'AR', label: 'AR (信息结束)' },
  { id: 'SK', label: 'SK (终结通联)' },
  { id: 'K', label: 'K (邀请回复)' },
  { id: '===', label: '=== (双向标记)' },
  { id: '', label: '无 (关闭报尾)' },
];
