'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Moon, Sun, Share2, User, Trophy } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/useUserStore';

export default function Navbar() {
    const { theme, toggleTheme } = useUserStore();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleShare = async () => {
        if (navigator.share) {
            await navigator.share({
                title: 'AI Tool Hub',
                text: '发现最佳 AI 工具',
                url: window.location.href,
            });
        } else {
            await navigator.clipboard.writeText(window.location.href);
        }
    };

    return (
        <nav
            className={cn(
                'sticky top-0 z-[1000] h-16 border-b transition-all duration-300',
                scrolled
                    ? 'bg-[rgba(15,12,41,0.85)] backdrop-blur-xl border-[rgba(0,212,255,0.15)] shadow-[0_1px_20px_rgba(0,212,255,0.05)]'
                    : 'bg-transparent backdrop-blur-xl border-[rgba(255,255,255,0.05)]',
            )}
        >
            <div className="flex items-center justify-between h-full px-4 sm:px-6 max-w-[1200px] mx-auto">
                {/* Brand */}
                <Link href="/" className="flex items-center gap-2.5 no-underline group">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--neon-blue)] to-[var(--neon-purple)] flex items-center justify-center text-white text-sm transition-transform duration-150 group-hover:scale-110 group-hover:-rotate-1">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <span className="text-lg font-bold text-[var(--text-primary)] tracking-tight hidden sm:inline">
                        AI Tool Hub
                    </span>
                </Link>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={toggleTheme}
                        className="w-9 h-9 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer transition-all duration-150 hover:border-[rgba(0,212,255,0.3)] hover:text-[var(--text-primary)]"
                        aria-label="切换主题"
                    >
                        {theme === 'dark' ? (
                            <Sun className="w-4 h-4" />
                        ) : (
                            <Moon className="w-4 h-4" />
                        )}
                    </button>

                    <Link
                    href="/user"
                    className="w-9 h-9 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer transition-all duration-150 hover:border-[rgba(0,212,255,0.3)] hover:text-[var(--text-primary)]"
                    aria-label="我的工具箱"
                >
                    <User className="w-4 h-4" />
                </Link>
                <Link
                    href="/leaderboard"
                    className="w-9 h-9 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer transition-all duration-150 hover:border-[rgba(0,212,255,0.3)] hover:text-[var(--text-primary)]"
                    aria-label="排行榜"
                >
                    <Trophy className="w-4 h-4" />
                </Link>

                <button
                        onClick={handleShare}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] text-xs cursor-pointer transition-all duration-150 hover:border-[rgba(0,212,255,0.3)] hover:text-[var(--text-primary)] hover:bg-[rgba(0,212,255,0.05)] whitespace-nowrap"
                    >
                        <Share2 className="w-3.5 h-3.5 text-[var(--neon-blue)]" />
                        <span className="hidden sm:inline">分享</span>
                    </button>
                </div>
            </div>
        </nav>
    );
}
