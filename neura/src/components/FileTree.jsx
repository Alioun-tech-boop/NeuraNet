import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FileJson, FileCode } from 'lucide-react';

const MOCK_TREE = [
  { name: 'src', type: 'dir', children: [
    { name: 'components', type: 'dir', children: [
      { name: 'Button.jsx', type: 'file' }, { name: 'Composer.jsx', type: 'file' },
    ]},
    { name: 'lib', type: 'dir', children: [{ name: 'neuraAdapter.js', type: 'file' }] },
    { name: 'api', type: 'dir', children: [{ name: 'auth.service.js', type: 'file' }] },
  ]},
  { name: 'package.json', type: 'file' },
  { name: 'README.md', type: 'file' },
];

function Node({ node, depth = 0, onSelect, selected }) {
  const [open, setOpen] = useState(depth < 1);
  const isDir = node.type === 'dir';
  const isSelected = selected === node.name;
  const Icon = isDir ? Folder : node.name.endsWith('.json') ? FileJson : node.name.endsWith('.js') ? FileCode : File;

  return (
    <div>
      <button
        onClick={() => isDir ? setOpen(v => !v) : onSelect(node.name)}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[13px] hover:bg-white/[0.06] ${isSelected ? 'bg-white text-neura-bg' : 'text-neura-sub'}`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {isDir ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span className="w-3" />}
        <Icon size={13} className={isSelected ? 'text-neura-bg' : 'text-neura-muted'} />
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && open && node.children?.map(child => (
        <Node key={child.name} node={child} depth={depth + 1} onSelect={onSelect} selected={selected} />
      ))}
    </div>
  );
}

export default function FileTree({ onSelect, selected }) {
  return (
    <div className="h-full overflow-auto bg-neura-surface p-2">
      <div className="px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neura-muted">Explorer</div>
      {MOCK_TREE.map(n => <Node key={n.name} node={n} onSelect={onSelect} selected={selected} />)}
    </div>
  );
}
