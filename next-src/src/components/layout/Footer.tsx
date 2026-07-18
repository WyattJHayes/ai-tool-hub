import { Sparkles } from 'lucide-react';
import Image from 'next/image';

export default function Footer() {
    return (
        <footer className="border-t border-[var(--glass-border)] px-6 pt-12 pb-28 md:pb-12 mt-12 relative z-[1]">
            <div className="max-w-[1200px] mx-auto">
                <div className="flex justify-between gap-6 flex-wrap">
                    {/* Brand */}
                    <div>
                        <div className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
                            <Sparkles className="w-4 h-4 text-[var(--neon-blue)]" />
                            AI Tool Hub
                        </div>
                        <p className="text-[13px] text-[var(--text-tertiary)] mt-2 max-w-[300px] leading-relaxed">
                            发现和探索最佳 AI 工具，提升你的工作效率。
                        </p>
                    </div>

                    {/* Links */}
                    <div className="flex gap-4 flex-wrap items-start">
                        <a
                            href="https://github.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--neon-blue)]"
                        >
                            GitHub
                        </a>
                        <a
                            href="https://github.com/a895411690/ai-tool-hub"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--neon-blue)]"
                        >
                            关于我们
                        </a>
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="mt-7 pt-5 border-t border-[var(--glass-border)] flex justify-between gap-3 flex-wrap text-xs text-[var(--text-tertiary)]">
                    <span>© {new Date().getFullYear()} AI Tool Hub. All rights reserved.</span>
                    <div className="flex items-center gap-4">
                        <a
                            href="https://beian.miit.gov.cn/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--text-tertiary)] transition-colors duration-150 hover:text-[var(--text-secondary)]"
                        >
                            沪ICP备2026013388号
                        </a>
                        <a
                            href="https://beian.mps.gov.cn/#/query/webSearch?code=31011502405714"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[var(--text-tertiary)] transition-colors duration-150 hover:text-[var(--text-secondary)]"
                        >
                            <Image src="/beian-icon.png" alt="公安备案" width={14} height={14} />
                            沪公网安备31011502405714号
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
