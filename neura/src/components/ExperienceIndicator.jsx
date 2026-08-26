import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export default function ExperienceIndicator({ experience, onExpand }) {
  if (!experience) return null;
  const found = experience.found;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      className="flex items-center gap-2 text-[12px]"
    >
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${found ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : 'border-neura-border bg-neura-surface text-neura-muted'}`}>
        <Sparkles size={11} />
        {found ? 'Experience found' : 'New experience'}
      </span>
      <span className="text-neura-muted">
        {found ? `${experience.similarity != null ? `${(experience.similarity * 100).toFixed(0)}% semantic match · ` : ''}strategy adapted` : 'learning how to solve this class'}
      </span>
      <button onClick={onExpand} className="text-neura-accent hover:underline text-[11px]">details →</button>
    </motion.div>
  );
}
